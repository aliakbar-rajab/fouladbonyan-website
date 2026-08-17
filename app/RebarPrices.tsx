import {
  Fragment,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  calculateRebarWeight,
  getCategoryPricingState,
  getTrendPresentation,
} from "./catalog-behavior.mjs";
import { loadRebarPriceData } from "./catalog-data";
import type {
  CatalogPriceData,
  CatalogRow,
  CatalogViewRequest,
} from "./catalog-types";
import { localizeCatalogValue, toPersianDigits } from "./catalog-utils";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";

export type PriceCatalogConfig = {
  productLabel: string;
  initialCategoryId: string;
  categoryIcons: Record<string, string>;
  tabClassName?: string;
  showWeightCalculator?: boolean;
};

// Percent change is passed maximumFractionDigits: 2, matching the precision the
// source publishes. At 0 any move under half a percent renders as "۰٪" next to
// an up/down arrow, which reads as no change at all.
function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("fa-IR", { maximumFractionDigits });
}

function displayPrice(
  price: number | null,
  taxIncluded: boolean,
  taxRate: number,
) {
  if (!price) return "تماس بگیرید";
  const adjustedPrice = taxIncluded
    ? Math.round((price * (1 + taxRate)) / 100) * 100
    : price;
  return formatNumber(adjustedPrice);
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
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      className="tax-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
    >
      <span className="tax-switch-track" aria-hidden="true">
        <i />
      </span>
      <span>ارزش افزوده</span>
    </button>
  );
}

function getRowDetails(
  row: CatalogRow,
  factoryName: string,
  groupingLabel: string,
) {
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
    { label: "آخرین بروزرسانی", value: toPersianDigits(row.updatedDate) || "—" },
  ];
}

export function PriceCatalog({
  priceData,
  config,
  phoneHref,
  requestedView,
}: {
  priceData: CatalogPriceData;
  config: PriceCatalogConfig;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
}) {
  const initialCategory =
    priceData.categories.find(
      (category) => category.id === config.initialCategoryId,
    ) ?? priceData.categories[0];
  if (!initialCategory) {
    throw new Error(`داده قیمت ${config.productLabel} در دسترس نیست.`);
  }
  const factorySelectId = useId();
  const sizeSelectId = useId();
  const tabsId = useId().replaceAll(":", "");
  const categoryTabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [categoryId, setCategoryId] = useState(
    requestedView?.categoryId ?? initialCategory.id,
  );
  const [factoryFilter, setFactoryFilter] = useState(
    requestedView?.factory ?? "",
  );
  const [sizeFilter, setSizeFilter] = useState(requestedView?.size ?? "");
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [diameter, setDiameter] = useState("16");
  const [length, setLength] = useState("12");
  const [quantity, setQuantity] = useState("1");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    () => new Set(),
  );
  const [showAllFactories, setShowAllFactories] = useState(false);

  const category =
    priceData.categories.find((item) => item.id === categoryId) ??
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

  const visibleFactories = showAllFactories
    ? filteredFactories
    : filteredFactories.slice(0, 6);
  const remainingFactories = Math.max(
    filteredFactories.length - visibleFactories.length,
    0,
  );
  const activeFilterCount = Number(Boolean(factoryFilter)) + Number(Boolean(sizeFilter));

  const calculatorWeight = useMemo(
    () => calculateRebarWeight(diameter, length, quantity),
    [diameter, length, quantity],
  );
  const quantityInvalid =
    quantity !== "" &&
    (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0);
  const pricingState = useMemo(
    () => getCategoryPricingState(category),
    [category],
  );

  const fetchedDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(priceData.fetchedAt));

  const changeCategory = (id: string) => {
    setCategoryId(id);
    setFactoryFilter("");
    setSizeFilter("");
    setExpandedRows(new Set());
    setShowAllFactories(false);
  };

  const moveCategoryTabFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let targetIndex: number;
    if (event.key === "ArrowLeft") {
      targetIndex = (currentIndex + 1) % priceData.categories.length;
    } else if (event.key === "ArrowRight") {
      targetIndex =
        (currentIndex - 1 + priceData.categories.length) %
        priceData.categories.length;
    } else if (event.key === "Home") {
      targetIndex = 0;
    } else if (event.key === "End") {
      targetIndex = priceData.categories.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    changeCategory(priceData.categories[targetIndex].id);
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
    displayPrice(price, taxIncluded, priceData.taxRate);

  return (
    <div className="rebar-prices">
      <div
        className={`rebar-kind-tabs ${config.tabClassName ?? ""}`.trim()}
        role="tablist"
        aria-label={`نوع ${config.productLabel}`}
      >
        {priceData.categories.map((item, index) => (
          <button
            type="button"
            role="tab"
            id={`${tabsId}-tab-${item.id}`}
            aria-selected={item.id === category.id}
            aria-controls={`${tabsId}-panel-${item.id}`}
            tabIndex={item.id === category.id ? 0 : -1}
            key={item.id}
            ref={(node) => {
              categoryTabRefs.current[index] = node;
            }}
            onClick={() => changeCategory(item.id)}
            onKeyDown={(event) => moveCategoryTabFocus(event, index)}
          >
            <span aria-hidden="true">{config.categoryIcons[item.id] ?? "◆"}</span>
            قیمت {item.label}
          </button>
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
                قیمت {category.label} امروز {toPersianDigits(category.summary.date)} در بازه‌ای
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
                  {formatNumber(Math.abs(category.summary.percent), 2)}٪
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
              ? `${formatNumber(
                  filteredFactories.reduce(
                    (total, factory) => total + factory.rows.length,
                    0,
                  ),
                )} ردیف قیمت از ${formatNumber(
                  filteredFactories.length,
                )} ${category.groupingLabel}`
              : "برای این فیلتر قیمتی پیدا نشد."}
          </p>

          <div className="factory-price-list">
            {visibleFactories.map((factory) => (
              <section className="factory-price-card" key={factory.name}>
                <header>
                  <TaxSwitch
                    checked={taxIncluded}
                    onChange={() => setTaxIncluded((current) => !current)}
                  />
                  <h4>
                    قیمت {category.label} {factory.name}
                  </h4>
                  <p>
                    <span aria-hidden="true">▣</span> آخرین بروزرسانی:{" "}
                    <b>{toPersianDigits(factory.updatedDate) || "—"}</b>
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
                                  priceData.taxRate,
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
                                  ? `${formatNumber(trend.amount, 2)}٪`
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
                                        {localizeCatalogValue(detail.value)}
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

          {remainingFactories > 0 ? (
            <button
              className="show-more-factories"
              type="button"
              onClick={() => setShowAllFactories(true)}
            >
              نمایش {formatNumber(remainingFactories)}{" "}
              {category.groupingLabel} دیگر
              <span aria-hidden="true">↓</span>
            </button>
          ) : null}
          {showAllFactories && filteredFactories.length > 6 ? (
            <button
              className="show-more-factories"
              type="button"
              onClick={() => setShowAllFactories(false)}
            >
              نمایش کمتر <span aria-hidden="true">↑</span>
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
          aria-label={`فیلترهای قیمت ${config.productLabel}`}
        >
          <section className="filter-card">
            <header>
              <span aria-hidden="true">⌁</span>
              <h3>فیلترها</h3>
              {activeFilterCount ? <b>{formatNumber(activeFilterCount)}</b> : null}
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

          {config.showWeightCalculator ? (
            <section className="calculator-card">
            <button
              type="button"
              aria-expanded={calculatorOpen}
              aria-controls="rebar-weight-calculator"
              onClick={() => setCalculatorOpen((current) => !current)}
            >
              <span aria-hidden="true">⚖</span>
              <span>
                <strong>محاسبه وزن میلگرد</strong>
                <small>بر اساس فرمول وزن استاندارد</small>
              </span>
              <b aria-hidden="true">{calculatorOpen ? "−" : "+"}</b>
            </button>
            {calculatorOpen ? (
              <div id="rebar-weight-calculator" className="calculator-fields">
                <label>
                  قطر (میلی‌متر)
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={diameter}
                    onChange={(event) => setDiameter(event.target.value)}
                  />
                </label>
                <label>
                  طول هر شاخه (متر)
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={length}
                    onChange={(event) => setLength(event.target.value)}
                  />
                </label>
                <label>
                  تعداد شاخه
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={quantity}
                    aria-invalid={quantityInvalid}
                    aria-describedby={
                      quantityInvalid ? "rebar-quantity-error" : undefined
                    }
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                {quantityInvalid ? (
                  <small id="rebar-quantity-error" role="alert">
                    تعداد شاخه باید یک عدد صحیح مثبت باشد.
                  </small>
                ) : null}
                <p>
                  وزن تقریبی:
                  <strong>
                    {calculatorWeight === null
                      ? " — "
                      : ` ${formatNumber(calculatorWeight, 2)} `}
                    کیلوگرم
                  </strong>
                </p>
              </div>
            ) : null}
            </section>
          ) : null}

          <section className="price-source-card">
            <span>آخرین دریافت داده</span>
            <strong>{fetchedDate}</strong>
            <p>
              قیمت‌ها به‌صورت خودکار از مرجع عمومی بازار دریافت شده‌اند و پیش
              از خرید باید با واحد فروش تأیید شوند.
            </p>
            <a href={category.sourceUrl} target="_blank" rel="noreferrer">
              منبع: {priceData.sourceName} ↗
            </a>
          </section>

          <section className="rebar-contact-card">
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

const rebarConfig: PriceCatalogConfig = {
  productLabel: "میلگرد",
  initialCategoryId: "ribbed",
  categoryIcons: {
    ribbed: "╱╱",
    simple: "━",
    stainless: "◈",
    alloy: "◆",
  },
  showWeightCalculator: true,
};

export default function RebarPrices({
  phoneHref,
  requestedView,
}: {
  phoneHref: string;
  requestedView?: CatalogViewRequest;
}) {
  const state = useCatalogData(loadRebarPriceData, "rebar");

  if (state.status !== "ready") {
    return <CatalogLoadMessage status={state.status} subject="قیمت میلگرد" />;
  }

  return (
    <PriceCatalog
      priceData={state.data}
      config={rebarConfig}
      phoneHref={phoneHref}
      requestedView={requestedView}
    />
  );
}
