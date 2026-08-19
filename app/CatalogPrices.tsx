import {
  Fragment,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  getCategoryPricingState,
  getTrendPresentation,
} from "./catalog-behavior.mjs";
import type { CatalogRow, CatalogViewRequest } from "./catalog-types";
import { getCategoryById, type ProductGroupId } from "./category-meta";
import {
  catalogPresentation,
  type CatalogPresentation,
} from "./catalog-presentation";
import { loadGroupCatalog, type GroupCatalog } from "./group-catalog";
import {
  formatCatalogNumber,
  localizeCatalogValue,
  toPersianDigits,
  unixSecondsToIso,
} from "./catalog-utils";
import { RebarWeightCalculator } from "./RebarWeightCalculator";
import { CatalogLoadMessage } from "./site-ui";
import { nextRovingIndex } from "./roving-tabs";
import { useCatalogData } from "./use-catalog-data";

/*
 * How many factory cards stay on screen before the "show more" control. The
 * overflow is collapsed with CSS rather than left unrendered: the prerendered
 * HTML for a subcategory page is that subcategory's only unique content, and
 * "Google Search does not interact with your page", so anything conditionally
 * rendered behind this button would never be crawled. Keep every row in the
 * DOM; hide the overflow visually.
 */
const INITIAL_FACTORY_COUNT = 6;

function displayPrice(
  price: number | null,
  taxIncluded: boolean,
  taxRate: number,
) {
  if (!price) return "تماس بگیرید";
  const adjustedPrice = taxIncluded
    ? Math.round((price * (1 + taxRate)) / 100) * 100
    : price;
  return formatCatalogNumber(adjustedPrice);
}

const statIcons = { max: "↗", min: "↘", change: "▥", average: "▥" };

function StatIcon({ type }: { type: keyof typeof statIcons }) {
  return (
    <span className={`rebar-stat-icon is-${type}`} aria-hidden="true">
      {statIcons[type]}
    </span>
  );
}

function TaxSwitch({
  checked,
  factoryName,
  onChange,
}: {
  checked: boolean;
  factoryName: string;
  onChange: () => void;
}) {
  return (
    <button
      className="tax-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      // One switch per factory card keeps the control in reach down a long
      // list, but they all drive the same state -- so each needs a name that
      // says which card it sits in, or a screen reader reads N identical
      // "ارزش افزوده" switches.
      aria-label={`ارزش افزوده در قیمت‌های ${factoryName}`}
      onClick={onChange}
    >
      <span className="tax-switch-track" aria-hidden="true">
        <i />
      </span>
      <span aria-hidden="true">ارزش افزوده</span>
    </button>
  );
}

function getRowDetails(
  row: CatalogRow,
  factoryName: string,
  groupingLabel: string,
): { label: string; value: string; iso?: string }[] {
  if (row.specifications?.length) {
    return [
      { label: "نام محصول", value: row.title },
      ...row.specifications.map((spec) => ({
        label: spec.label,
        value: localizeCatalogValue(spec.value),
      })),
      { label: "محل تحویل", value: row.delivery || "—" },
      { label: "واحد", value: row.unit || "—" },
      {
        label: groupingLabel,
        value: row.factory || factoryName || "—",
      },
      {
        label: "آخرین بروزرسانی",
        value: toPersianDigits(row.updatedDate) || "—",
        iso: unixSecondsToIso(row.updatedAt),
      },
    ];
  }

  return [
    { label: "نام محصول", value: row.title },
    { label: "حالت", value: localizeCatalogValue(row.form) || "—" },
    { label: "وزن تقریبی", value: localizeCatalogValue(row.approximateWeight) || "—" },
    {
      label: "طول شاخه",
      value: row.branchLength
        ? row.branchLength.includes("متر")
          ? localizeCatalogValue(row.branchLength)
          : `${localizeCatalogValue(row.branchLength)} متر`
        : "—",
    },
    { label: "گرید", value: localizeCatalogValue(row.grade) || "—" },
    { label: "واحد", value: row.unit || "—" },
    {
      label: groupingLabel,
      value: row.factory || factoryName || "—",
    },
    {
      label: "آخرین بروزرسانی",
      value: toPersianDigits(row.updatedDate) || "—",
      iso: unixSecondsToIso(row.updatedAt),
    },
  ];
}

/**
 * The price table for one product group's catalog: category tabs, the summary,
 * the factory cards, and the filter sidebar.
 *
 * It renders any GroupCatalog. Product-specific tools go in `sidebarExtra` so
 * no one group's feature lands in here.
 */
export function PriceCatalog({
  catalog,
  presentation,
  phoneHref,
  requestedView,
  sidebarExtra,
}: {
  catalog: GroupCatalog;
  presentation: CatalogPresentation;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
  sidebarExtra?: ReactNode;
}) {
  const initialCategory =
    catalog.categories.find(
      (category) => category.id === catalog.initialCategoryId,
    ) ?? catalog.categories[0];
  if (!initialCategory) {
    throw new Error(`داده قیمت ${catalog.label} در دسترس نیست.`);
  }
  const factorySelectId = useId();
  const sizeSelectId = useId();
  const factoryListId = useId().replaceAll(":", "");
  const tabsId = useId().replaceAll(":", "");
  const categoryTabRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const [categoryId, setCategoryId] = useState(
    requestedView?.categoryId ?? initialCategory.id,
  );
  const [factoryFilter, setFactoryFilter] = useState(
    requestedView?.factory ?? "",
  );
  const [sizeFilter, setSizeFilter] = useState(requestedView?.size ?? "");
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    () => new Set(),
  );
  const [showAllFactories, setShowAllFactories] = useState(false);

  const category =
    catalog.categories.find((item) => item.id === categoryId) ??
    initialCategory;

  const filteredFactories = useMemo(
    () =>
      category.factories
        .filter((factory) => !factoryFilter || factory.name === factoryFilter)
        .map((factory) => ({
          ...factory,
          rows: factory.rows.filter(
            (row) => !sizeFilter || row.size === sizeFilter,
          ),
        }))
        .filter((factory) => factory.rows.length > 0),
    [category, factoryFilter, sizeFilter],
  );

  const collapsedFactories = Math.max(
    filteredFactories.length - INITIAL_FACTORY_COUNT,
    0,
  );
  const activeFilterCount = Number(Boolean(factoryFilter)) + Number(Boolean(sizeFilter));

  const pricingState = useMemo(
    () => getCategoryPricingState(category),
    [category],
  );

  const fetchedDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(catalog.fetchedAt));

  const changeCategory = (id: string) => {
    setCategoryId(id);
    setFactoryFilter("");
    setSizeFilter("");
    setExpandedRows(new Set());
    setShowAllFactories(false);
  };

  const moveCategoryTabFocus = (
    event: ReactKeyboardEvent<HTMLElement>,
    currentIndex: number,
  ) => {
    const targetIndex = nextRovingIndex(
      event.key,
      currentIndex,
      catalog.categories.length,
    );
    if (targetIndex === null) return;

    event.preventDefault();
    changeCategory(catalog.categories[targetIndex].id);
    categoryTabRefs.current[targetIndex]?.focus();
  };

  const clearFilters = () => {
    setFactoryFilter("");
    setSizeFilter("");
    setShowAllFactories(false);
  };

  const toggleRow = (rowId: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const summaryPrice = (price: number) =>
    displayPrice(price, taxIncluded, catalog.taxRate);

  return (
    <div className="rebar-prices">
      <div
        className={`rebar-kind-tabs ${presentation.tabClassName ?? ""}`.trim()}
        role="tablist"
        aria-label={`نوع ${catalog.label}`}
      >
        {catalog.categories.map((item, index) => (
          <a
            href={`/${catalog.id}/${item.id}/`}
            role="tab"
            id={`${tabsId}-tab-${item.id}`}
            aria-selected={item.id === category.id}
            aria-controls={`${tabsId}-panel-${item.id}`}
            tabIndex={item.id === category.id ? 0 : -1}
            key={item.id}
            ref={(node) => {
              categoryTabRefs.current[index] = node;
            }}
            onClick={(event) => {
              event.preventDefault();
              changeCategory(item.id);
            }}
            onKeyDown={(event) => moveCategoryTabFocus(event, index)}
          >
            <span aria-hidden="true">
              {presentation.categoryIcons[item.id] ?? "◆"}
            </span>
            {`قیمت ${item.label}`}
          </a>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-${category.id}`}
        aria-labelledby={`${tabsId}-tab-${category.id}`}
        tabIndex={0}
      >
      <div className="rebar-layout">
        <div className="rebar-main">
          <section
            className="rebar-summary"
            aria-labelledby={`catalog-price-title-${category.id}`}
          >
            <h3 id={`catalog-price-title-${category.id}`}>
              قیمت {category.label}
            </h3>
            {!pricingState.hasPrices ? (
              <p>
                قیمت عددی {category.label} امروز اعلام نشده است. برای استعلام
                قیمت و موجودی با واحد فروش تماس بگیرید.
              </p>
            ) : pricingState.units.length > 1 ? (
              <p>
                قیمت‌های {category.label} با واحدهای فروش متفاوت ثبت شده‌اند؛
                مبلغ و واحد هر ردیف را در جدول بررسی کنید.
              </p>
            ) : (
              <p>
                قیمت {category.label} امروز{" "}
                <time dateTime={catalog.fetchedAt}>
                  {toPersianDigits(category.summary.date)}
                </time>{" "}
                در بازه‌ای
                بین <b>{summaryPrice(category.summary.min)}</b> تا{" "}
                <b>{summaryPrice(category.summary.max)}</b> تومان
                {taxIncluded
                  ? " (با احتساب ارزش افزوده) "
                  : " (بدون احتساب ارزش افزوده) "}
                قرار دارد.
              </p>
            )}
            {pricingState.hasPrices && pricingState.units.length === 1 ? (
              <div className="rebar-stats">
              <article className="is-max">
                <StatIcon type="max" />
                <span>بیشترین قیمت</span>
                <strong>{summaryPrice(category.summary.max)}</strong>
                <small>تومان</small>
              </article>
              <article className="is-min">
                <StatIcon type="min" />
                <span>کمترین قیمت</span>
                <strong>{summaryPrice(category.summary.min)}</strong>
                <small>تومان</small>
              </article>
              <article className="is-change">
                <StatIcon type="change" />
                <span>میزان نوسان روزانه</span>
                <strong>
                  {
                    getTrendPresentation(
                      category.summary.status,
                      category.summary.percent,
                    ).direction
                  }{" "}
                  {formatCatalogNumber(Math.abs(category.summary.percent), 2)}٪
                </strong>
                <small>نسبت به روز قبل</small>
              </article>
              <article className="is-average">
                <StatIcon type="average" />
                <span>میانگین قیمت بازار</span>
                <strong>{summaryPrice(category.summary.average)}</strong>
                <small>تومان</small>
              </article>
              </div>
            ) : null}
          </section>

          <p className="rebar-result-status" role="status" aria-live="polite">
            {filteredFactories.length
              ? `${formatCatalogNumber(
                  filteredFactories.reduce(
                    (total, factory) => total + factory.rows.length,
                    0,
                  ),
                )} ردیف قیمت از ${formatCatalogNumber(
                  filteredFactories.length,
                )} ${category.groupingLabel}`
              : "برای این فیلتر قیمتی پیدا نشد."}
          </p>

          <div className="factory-price-list" id={factoryListId}>
            {filteredFactories.map((factory, factoryIndex) => (
              <section
                className={
                  !showAllFactories && factoryIndex >= INITIAL_FACTORY_COUNT
                    ? "factory-price-card is-collapsed"
                    : "factory-price-card"
                }
                key={factory.name}
              >
                <header>
                  <TaxSwitch
                    checked={taxIncluded}
                    factoryName={factory.name}
                    onChange={() => setTaxIncluded((current) => !current)}
                  />
                  <h4>
                    قیمت {category.label} {factory.name}
                  </h4>
                  <p>
                    <span aria-hidden="true">▣</span> آخرین بروزرسانی:{" "}
                    <b>
                      <time dateTime={unixSecondsToIso(factory.updatedAt)}>
                        {toPersianDigits(factory.updatedDate) || "—"}
                      </time>
                    </b>
                  </p>
                </header>

                <div className="table-scroll">
                  <table className="rebar-price-table">
                    <caption className="sr-only">
                      قیمت {category.label} {category.groupingLabel}{" "}
                      {factory.name}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" aria-label="جزئیات" />
                        <th scope="col">سایز</th>
                        <th scope="col">{category.specificationLabel}</th>
                        <th scope="col">محل تحویل</th>
                        <th scope="col">قیمت</th>
                        <th scope="col">نوسان</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factory.rows.map((row, rowIndex) => {
                        const expanded = expandedRows.has(row.id);
                        const trend = getTrendPresentation(
                          row.status,
                          row.percent,
                        );
                        return (
                          <Fragment key={row.id}>
                            <tr
                              className={`rebar-row-group${
                                rowIndex % 2 === 1 ? " is-dark-row" : ""
                              }`}
                            >
                              <td data-label="جزئیات" className="row-expand-cell">
                                <button
                                  type="button"
                                  aria-expanded={expanded}
                                  aria-controls={`row-detail-${row.id}`}
                                  aria-label={`جزئیات ${row.title}`}
                                  onClick={() => toggleRow(row.id)}
                                >
                                  {expanded ? "⌃" : "⌄"}
                                </button>
                              </td>
                              <td data-label="سایز">
                                {localizeCatalogValue(row.size)}
                              </td>
                              <td data-label={category.specificationLabel}>
                                {localizeCatalogValue(
                                  row.specification ||
                                    row.standard ||
                                    row.grade ||
                                    "",
                                )}
                              </td>
                              <td data-label="محل تحویل">
                                {row.delivery || "—"}
                              </td>
                              <td
                                data-label="قیمت"
                                className={
                                  row.price ? "row-price" : "row-price is-call"
                                }
                              >
                                {displayPrice(
                                  row.price,
                                  taxIncluded,
                                  catalog.taxRate,
                                )}
                                {row.price ? (
                                  <small> تومان / {row.unit}</small>
                                ) : null}
                              </td>
                              <td
                                data-label="نوسان"
                                className={`row-change is-${row.status}`}
                              >
                                <span aria-hidden="true">{trend.symbol}</span>{" "}
                                {trend.direction}{" "}
                                {trend.amount
                                  ? `${formatCatalogNumber(trend.amount, 2)}٪`
                                  : ""}
                              </td>
                            </tr>
                            {expanded ? (
                              <tr className="rebar-detail-row">
                              <td
                                className="rebar-row-detail"
                                id={`row-detail-${row.id}`}
                                colSpan={6}
                              >
                                <dl>
                                  {getRowDetails(
                                    row,
                                    factory.name,
                                    category.groupingLabel,
                                  ).map((detail, index) => (
                                    <div
                                      key={`${row.id}-${detail.label}-${index}`}
                                    >
                                      <dt>{detail.label}</dt>
                                      <dd>
                                        {detail.iso ? (
                                          <time dateTime={detail.iso}>
                                            {localizeCatalogValue(detail.value)}
                                          </time>
                                        ) : (
                                          localizeCatalogValue(detail.value)
                                        )}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          {collapsedFactories > 0 ? (
            <button
              className="show-more-factories"
              type="button"
              aria-expanded={showAllFactories}
              aria-controls={factoryListId}
              onClick={() => setShowAllFactories((current) => !current)}
            >
              {showAllFactories ? (
                <>
                  نمایش کمتر <span aria-hidden="true">↑</span>
                </>
              ) : (
                <>
                  نمایش {formatCatalogNumber(collapsedFactories)}{" "}
                  {category.groupingLabel} دیگر
                  <span aria-hidden="true">↓</span>
                </>
              )}
            </button>
          ) : null}

          {!filteredFactories.length ? (
            <div className="rebar-empty">
              <strong>قیمتی با این مشخصات پیدا نشد.</strong>
              <button type="button" onClick={clearFilters}>
                حذف فیلترها
              </button>
            </div>
          ) : null}
        </div>

        <aside
          className="rebar-sidebar"
          aria-label={`فیلترهای قیمت ${catalog.label}`}
        >
          <section className="filter-card">
            <header>
              <span aria-hidden="true">⌁</span>
              <h3>فیلترها</h3>
              {activeFilterCount ? (
                <b>{formatCatalogNumber(activeFilterCount)}</b>
              ) : null}
            </header>
            <div className="filter-fields">
              <label htmlFor={factorySelectId}>{category.groupingLabel}</label>
              <select
                id={factorySelectId}
                value={factoryFilter}
                onChange={(event) => {
                  setFactoryFilter(event.target.value);
                  setShowAllFactories(false);
                }}
              >
                <option value="">همه {category.groupingLabel}‌ها</option>
                {category.filters.factories.map((factory) => (
                  <option value={factory} key={factory}>
                    {factory}
                  </option>
                ))}
              </select>

              <label htmlFor={sizeSelectId}>سایز</label>
              <select
                id={sizeSelectId}
                value={sizeFilter}
                onChange={(event) => {
                  setSizeFilter(event.target.value);
                  setShowAllFactories(false);
                }}
              >
                <option value="">همه سایزها</option>
                {category.filters.sizes.map((size) => (
                  <option value={size} key={size}>
                    سایز {localizeCatalogValue(size)}
                  </option>
                ))}
              </select>

              <button
                className="clear-rebar-filters"
                type="button"
                onClick={clearFilters}
                disabled={!activeFilterCount}
              >
                حذف تمامی فیلترها
              </button>
            </div>
          </section>

          {sidebarExtra}

          <section className="price-source-card" aria-label="آخرین دریافت داده">
            <span>آخرین دریافت داده</span>
            <strong>{fetchedDate}</strong>
            <p>
              قیمت‌ها به‌صورت خودکار از مرجع عمومی بازار دریافت شده‌اند و پیش
              از خرید باید با واحد فروش تأیید شوند.
            </p>
            <a href={category.sourceUrl} target="_blank" rel="noreferrer">
              منبع: {catalog.sourceName} ↗
            </a>
          </section>

          <section className="rebar-contact-card" aria-label="قیمت قطعی و موجودی">
            <span aria-hidden="true">☎</span>
            <strong>قیمت قطعی و موجودی</strong>
            <p>برای تأیید قیمت، تناژ و زمان تحویل با واحد فروش تماس بگیرید.</p>
            <a href={phoneHref}>تماس با واحد فروش</a>
          </section>
        </aside>
      </div>
      </div>
    </div>
  );
}

/** Product-specific sidebar tools, by group. */
const sidebarExtras: Partial<Record<ProductGroupId, ReactNode>> = {
  rebar: <RebarWeightCalculator />,
};

export default function CatalogPrices({
  groupId,
  phoneHref,
  requestedView,
}: {
  groupId: ProductGroupId;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
}) {
  const state = useCatalogData(loadGroupCatalog, groupId);

  if (state.status !== "ready") {
    return (
      <CatalogLoadMessage
        status={state.status}
        subject={`قیمت ${getCategoryById(groupId)?.label ?? "این گروه"}`}
      />
    );
  }

  return (
    <PriceCatalog
      catalog={state.data}
      presentation={catalogPresentation(groupId, state.data.categories)}
      phoneHref={phoneHref}
      requestedView={requestedView}
      sidebarExtra={sidebarExtras[groupId]}
    />
  );
}
