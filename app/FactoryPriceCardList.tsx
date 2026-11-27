import { Fragment } from "react";
import {
  effectiveRowSpecification,
  effectiveSpecificationLabel,
} from "./catalog-behavior.mjs";
import {
  type CatalogCategory,
  type CatalogFactory,
  type CatalogRow,
} from "./catalog-types";
import type { ProductGroupId } from "./category-meta";
import { formatPersianNumber, toPersianDigits } from "./persian-numbers.mjs";
import {
  formatCatalogSize,
  localizeCatalogValue,
  presentPrice,
  presentPriceMovement,
  unixSecondsToIso,
} from "./catalog-presentation";
import {
  QUOTE_FORM_HREF,
  writeQuoteHandoff,
  type QuoteHandoff,
} from "./quote-handoff";
import { ChevronDownIcon } from "./icons";
import { quoteProductForCategory } from "./quote/products";

/*
 * The row's quote action does go somewhere -- /quote-process/ -- so it stays an
 * anchor with a real href, and keeps everything that comes free with one:
 * middle-click and modifier-click open a new tab, the status bar shows the
 * destination, and a visitor without JavaScript still reaches the quote page.
 *
 * What it no longer does is carry the prefill in the URL. Every row used to
 * point at `/quote-process/?product=...&dimensions=...`, which put a distinct
 * crawlable URL on each of the ~2,100 price rows, all canonicalising back to
 * one page. That is form state, not a destination, so it now rides in
 * sessionStorage (see quote-handoff.ts) and the href is the single clean URL.
 *
 * The handler never calls preventDefault: it writes the handoff and gets out of
 * the way, so the browser performs its own navigation exactly as it always did.
 */
function quoteHandoffFor(
  groupId: ProductGroupId,
  categoryId: string,
  row: CatalogRow,
): QuoteHandoff {
  return {
    product: quoteProductForCategory(groupId, categoryId) ?? "",
    dimensions: row.title,
  };
}


/*
 * One switch for the whole category, not one per factory card.
 *
 * It was rendered inside every card header, each labelled "ارزش افزوده در
 * قیمت‌های {factory}" -- but all of them were bound to a single `taxIncluded`,
 * so flipping ذوب آهن's switch silently re-priced all twenty-seven cards and
 * the summary banner above them. The label promised a scope the control never
 * had, which is worst for a screen reader: twenty-seven switches each claiming
 * a different factory, one state behind them.
 */
function TaxSwitch({
  checked,
  categoryLabel,
  onChange,
}: {
  checked: boolean;
  categoryLabel: string;
  onChange: () => void;
}) {
  return (
    <button
      className="tax-switch"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`نمایش قیمت‌های ${categoryLabel} با ارزش افزوده`}
      onClick={onChange}
    >
      <span className="tax-switch-track" aria-hidden="true">
        <i />
      </span>
      <span aria-hidden="true">ارزش افزوده</span>
    </button>
  );
}

/**
 * A <time> only when there is a real instant to attach: an undated group has
 * nothing but a dash to show, and a <time> whose text is "—" carries no
 * machine reading at all.
 */
function FactoryUpdatedTime({
  updatedAt,
  updatedDate,
}: {
  updatedAt: number;
  updatedDate: string;
}) {
  const iso = unixSecondsToIso(updatedAt);
  const label = toPersianDigits(updatedDate) || "—";
  return iso ? <time dateTime={iso}>{label}</time> : <>{label}</>;
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
        label: "آخرین به‌روزرسانی",
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
      label: "آخرین به‌روزرسانی",
      value: toPersianDigits(row.updatedDate) || "—",
      iso: unixSecondsToIso(row.updatedAt),
    },
  ];
}

const PREFERRED_QUICK_MILLS = [
  "ذوب آهن",
  "کویر کاشان",
  "نیشابور",
  "میانه",
  "فایکو",
  "شاهین بناب",
  "ظفر بناب",
  "آناهیتا گیلان",
  "راد همدان",
  "بافق یزد",
  "کاوه تیکمه داش",
  "امیرکبیر",
];

const MAX_QUICK_MILLS = 10;

function pickQuickFilterMills(
  factories: readonly string[],
  activeFactory: string,
): string[] {
  const available = new Set(factories);
  const picked: string[] = [];
  for (const preferred of PREFERRED_QUICK_MILLS) {
    if (available.has(preferred)) picked.push(preferred);
  }
  for (const name of factories) {
    if (picked.length >= MAX_QUICK_MILLS) break;
    if (!picked.includes(name)) picked.push(name);
  }
  const limited = picked.slice(0, MAX_QUICK_MILLS);
  if (activeFactory && available.has(activeFactory) && !limited.includes(activeFactory)) {
    limited[limited.length - 1] = activeFactory;
  }
  return limited;
}

export function FactoryPriceCardList({
  catalogId,
  category,
  filteredFactories,
  factoryFilter,
  factoryListId,
  taxIncluded,
  taxRate,
  expandedRows,
  onToggleTax,
  onToggleRow,
  onFactoryFilterChange,
  onClearFilters,
}: {
  catalogId: ProductGroupId;
  category: CatalogCategory;
  filteredFactories: CatalogFactory[];
  factoryFilter: string;
  factoryListId: string;
  taxIncluded: boolean;
  taxRate: number;
  expandedRows: Set<number>;
  onToggleTax: () => void;
  onToggleRow: (rowId: number) => void;
  onFactoryFilterChange: (factory: string) => void;
  onClearFilters: () => void;
}) {
  const showQuickMillBar = category.filters.factories.length >= 6;
  const quickMills = showQuickMillBar
    ? pickQuickFilterMills(category.filters.factories, factoryFilter)
    : [];
  const specLabel = effectiveSpecificationLabel(category);
  const showApproxWeight = category.id === "scaffold-pipe";
  const tableColSpan = showApproxWeight ? 8 : 7;

  return (
    <>
      {showQuickMillBar ? (
        <nav
          className="mill-quick-bar"
          aria-label={`فیلتر سریع ${category.groupingLabel}`}
        >
          <button
            type="button"
            aria-pressed={factoryFilter === ""}
            onClick={() => onFactoryFilterChange("")}
          >
            همه ({formatPersianNumber(category.filters.factories.length)})
          </button>
          {quickMills.map((mill) => (
            <button
              type="button"
              key={mill}
              aria-pressed={factoryFilter === mill}
              onClick={() =>
                onFactoryFilterChange(factoryFilter === mill ? "" : mill)
              }
            >
              {mill}
            </button>
          ))}
        </nav>
      ) : null}

      <div className="rebar-result-bar">
        <p className="rebar-result-status" role="status" aria-live="polite">
          {filteredFactories.length
            ? `${formatPersianNumber(
                filteredFactories.reduce(
                  (total, factory) => total + factory.rows.length,
                  0,
                ),
              )} ردیف قیمت از ${formatPersianNumber(
                filteredFactories.length,
              )} ${category.groupingLabel}`
            : "برای این فیلتر قیمتی پیدا نشد."}
        </p>
        {filteredFactories.length ? (
          <TaxSwitch
            checked={taxIncluded}
            categoryLabel={category.label}
            onChange={onToggleTax}
          />
        ) : null}
      </div>

      <div className="factory-price-list" id={factoryListId}>
        {filteredFactories.map((factory) => (
          <section className="factory-price-card" key={factory.name}>
            <header>
              <h4>
                قیمت {category.label} {factory.name}
              </h4>
              <p>
                آخرین به‌روزرسانی:{" "}
                <b>
                  <FactoryUpdatedTime
                    updatedAt={factory.updatedAt}
                    updatedDate={factory.updatedDate}
                  />
                </b>
              </p>
            </header>

            <div className="table-scroll">
              <table
                className={
                  showApproxWeight
                    ? "rebar-price-table has-weight-col"
                    : "rebar-price-table"
                }
              >
                <caption className="sr-only">
                  قیمت {category.label} {category.groupingLabel} {factory.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" aria-label="جزئیات" />
                    <th scope="col">سایز</th>
                    <th scope="col">{specLabel}</th>
                    {showApproxWeight ? (
                      <th scope="col">وزن تقریبی شاخه</th>
                    ) : null}
                    <th scope="col">محل تحویل</th>
                    <th scope="col">قیمت</th>
                    <th scope="col">نوسان</th>
                    <th scope="col">استعلام</th>
                  </tr>
                </thead>
                <tbody>
                  {factory.rows.map((row, rowIndex) => {
                    const expanded = expandedRows.has(row.id);
                    const movement = presentPriceMovement(
                      row.status,
                      row.percent,
                    );
                    const price = presentPrice(row.price, {
                      unit: row.unit,
                      taxIncluded,
                      taxRate,
                    });
                    const sizeDisplay = formatCatalogSize(row.size, category.id);
                    const specValue = effectiveRowSpecification(row, category.id);
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
                              onClick={() => onToggleRow(row.id)}
                            >
                              <ChevronDownIcon
                                className={expanded ? "is-expanded" : undefined}
                              />
                            </button>
                          </td>
                          <td data-label="سایز">
                            {sizeDisplay.ltr ? (
                              <bdi dir="ltr">{sizeDisplay.text}</bdi>
                            ) : (
                              sizeDisplay.text
                            )}
                          </td>
                          <td data-label={specLabel}>
                            {localizeCatalogValue(specValue)}
                          </td>
                          {showApproxWeight ? (
                            <td data-label="وزن تقریبی شاخه">
                              {row.approximateWeight
                                ? `${localizeCatalogValue(row.approximateWeight)} کیلوگرم`
                                : "—"}
                            </td>
                          ) : null}
                          <td data-label="محل تحویل">
                            {row.delivery || "—"}
                          </td>
                          <td
                            data-label="قیمت"
                            className={
                              price.available
                                ? "row-price"
                                : "row-price is-call"
                            }
                          >
                            {price.text}
                            {price.suffix ? (
                              <small> {price.suffix}</small>
                            ) : null}
                          </td>
                          <td
                            data-label="نوسان"
                            className={`row-change ${movement.toneClass}`}
                          >
                            {movement.text}
                          </td>
                          <td data-label="استعلام" className="row-quote-cell">
                            <a
                              href={QUOTE_FORM_HREF}
                              aria-label={`افزودن ${row.title} به درخواست پیش‌فاکتور`}
                              rel="nofollow"
                              onClick={() =>
                                writeQuoteHandoff(
                                  quoteHandoffFor(
                                    catalogId,
                                    category.id,
                                    row,
                                  ),
                                )
                              }
                            >
                              افزودن به درخواست
                            </a>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="rebar-detail-row">
                            <td
                              className="rebar-row-detail"
                              id={`row-detail-${row.id}`}
                              colSpan={tableColSpan}
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

      {!filteredFactories.length ? (
        <div className="rebar-empty">
          <strong>قیمتی با این مشخصات پیدا نشد.</strong>
          <button type="button" onClick={onClearFilters}>
            حذف فیلترها
          </button>
        </div>
      ) : null}
    </>
  );
}
