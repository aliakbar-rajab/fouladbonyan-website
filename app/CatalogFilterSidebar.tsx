import type { ReactNode } from "react";
import type { CatalogCategory } from "./catalog-types";
import { formatPersianNumber } from "./persian-numbers.mjs";
import { localizeCatalogValue } from "./catalog-utils";
import { PhoneIcon } from "./icons";

export function CatalogFilterSidebar({
  catalogLabel,
  category,
  factoryFilter,
  sizeFilter,
  activeFilterCount,
  factorySelectId,
  sizeSelectId,
  fetchedDate,
  sourceName,
  phoneHref,
  sidebarExtra,
  onFactoryFilterChange,
  onSizeFilterChange,
  onClearFilters,
}: {
  catalogLabel: string;
  category: CatalogCategory;
  factoryFilter: string;
  sizeFilter: string;
  activeFilterCount: number;
  factorySelectId: string;
  sizeSelectId: string;
  fetchedDate: string;
  sourceName: string;
  phoneHref: string;
  sidebarExtra?: ReactNode;
  onFactoryFilterChange: (value: string) => void;
  onSizeFilterChange: (value: string) => void;
  onClearFilters: () => void;
}) {
  return (
    <aside
      className="rebar-sidebar"
      aria-label={`فیلترهای قیمت ${catalogLabel}`}
    >
      <section className="filter-card">
        <header>
          <h3>فیلترها</h3>
          {activeFilterCount ? (
            <b>{formatPersianNumber(activeFilterCount)}</b>
          ) : null}
        </header>
        <div className="filter-fields">
          <label htmlFor={factorySelectId}>{category.groupingLabel}</label>
          <select
            id={factorySelectId}
            value={factoryFilter}
            onChange={(event) => onFactoryFilterChange(event.target.value)}
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
            onChange={(event) => onSizeFilterChange(event.target.value)}
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
            onClick={onClearFilters}
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
          منبع: {sourceName}
        </a>
      </section>

      <section className="rebar-contact-card" aria-label="قیمت قطعی و موجودی">
        <PhoneIcon className="rebar-contact-icon" />
        <strong>قیمت قطعی و موجودی</strong>
        <p>برای تأیید قیمت، تناژ و زمان تحویل با واحد فروش تماس بگیرید.</p>
        <a href={phoneHref}>تماس با واحد فروش</a>
      </section>
    </aside>
  );
}
