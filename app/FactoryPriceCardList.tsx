import { Fragment } from "react";
import { getTrendPresentation } from "./catalog-behavior.mjs";
import {
  INITIAL_FACTORY_COUNT,
  type CatalogCategory,
  type CatalogFactory,
  type CatalogRow,
} from "./catalog-types";
import type { ProductGroupId } from "./category-meta";
import {
  displayPrice,
  formatCatalogNumber,
  localizeCatalogValue,
  unixSecondsToIso,
} from "./catalog-utils";
import { toPersianDigits } from "./persian-numbers.mjs";
import { ChevronDownIcon } from "./icons";

const quoteProductByGroup: Record<ProductGroupId, string> = {
  rebar: "میلگرد",
  beam: "تیرآهن",
  sheet: "ورق فولادی",
  profile: "پروفیل و قوطی",
  pipe: "لوله فولادی",
  angle: "نبشی",
  channel: "ناودانی",
  wire: "مفتول و سیم",
};

function quoteHref(
  groupId: ProductGroupId,
  categoryLabel: string,
  row: CatalogRow,
) {
  const product =
    groupId === "beam" && categoryLabel.includes("هاش")
      ? "هاش"
      : quoteProductByGroup[groupId];
  return `/quote-process/?product=${encodeURIComponent(product)}&dimensions=${encodeURIComponent(row.title)}#quote-form`;
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

export function FactoryPriceCardList({
  catalogId,
  category,
  filteredFactories,
  collapsedFactories,
  showAllFactories,
  factoryListId,
  taxIncluded,
  taxRate,
  expandedRows,
  onToggleTax,
  onToggleRow,
  onToggleShowAllFactories,
  onClearFilters,
}: {
  catalogId: ProductGroupId;
  category: CatalogCategory;
  filteredFactories: CatalogFactory[];
  collapsedFactories: number;
  showAllFactories: boolean;
  factoryListId: string;
  taxIncluded: boolean;
  taxRate: number;
  expandedRows: Set<number>;
  onToggleTax: () => void;
  onToggleRow: (rowId: number) => void;
  onToggleShowAllFactories: () => void;
  onClearFilters: () => void;
}) {
  return (
    <>
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
                onChange={onToggleTax}
              />
              <h4>
                قیمت {category.label} {factory.name}
              </h4>
              <p>
                آخرین بروزرسانی:{" "}
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
                  قیمت {category.label} {category.groupingLabel} {factory.name}
                </caption>
                <thead>
                  <tr>
                    <th scope="col" aria-label="جزئیات" />
                    <th scope="col">سایز</th>
                    <th scope="col">{category.specificationLabel}</th>
                    <th scope="col">محل تحویل</th>
                    <th scope="col">قیمت</th>
                    <th scope="col">نوسان</th>
                    <th scope="col">استعلام</th>
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
                              onClick={() => onToggleRow(row.id)}
                            >
                              <ChevronDownIcon
                                className={expanded ? "is-expanded" : undefined}
                              />
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
                              taxRate,
                            )}
                            {row.price ? (
                              <small> تومان / {row.unit}</small>
                            ) : null}
                          </td>
                          <td
                            data-label="نوسان"
                            className={`row-change is-${row.status}`}
                          >
                            {trend.direction}{" "}
                            {trend.amount
                              ? `${formatCatalogNumber(trend.amount, 2)}٪`
                              : ""}
                          </td>
                          <td data-label="استعلام" className="row-quote-cell">
                            <a href={quoteHref(catalogId, category.label, row)}>
                              افزودن به درخواست
                            </a>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="rebar-detail-row">
                            <td
                              className="rebar-row-detail"
                              id={`row-detail-${row.id}`}
                              colSpan={7}
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
          onClick={onToggleShowAllFactories}
        >
          {showAllFactories
            ? "نمایش کمتر"
            : `نمایش ${formatCatalogNumber(collapsedFactories)} ${category.groupingLabel} دیگر`}
          <ChevronDownIcon
            className={showAllFactories ? "is-expanded" : undefined}
          />
        </button>
      ) : null}

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
