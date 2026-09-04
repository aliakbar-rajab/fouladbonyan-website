import { hasDisplayablePriceRange } from "./catalog-pricing.mjs";
import { getCategoryPricingState, getTrendPresentation } from "./catalog-behavior.mjs";
import type { CatalogCategory } from "./catalog-types";
import { formatCatalogNumber } from "./catalog-utils";
import { getCategoryById, type ProductGroupId } from "./category-meta";
import { loadGroupCatalog, type GroupCatalog } from "./catalog-reader";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";

/** "۲۷ کارخانه" / "۴ گرید" -- whichever the category is actually grouped by. */
function groupingCountLabel(category: CatalogCategory) {
  const count = category.filters.factories.length;
  return `${formatCatalogNumber(count)} ${category.groupingLabel}`;
}

function CategoryOverviewRow({
  groupId,
  category,
}: {
  groupId: ProductGroupId;
  category: CatalogCategory;
}) {
  const href = `/${groupId}/${category.id}/`;
  const pricingState = getCategoryPricingState(category);
  const hasRange = hasDisplayablePriceRange(pricingState, category.summary);
  const trend = getTrendPresentation(category.summary.status, category.summary.percent);

  return (
    <tr className="overview-row">
      <td className="overview-cell-group">
        <a
          href={href}
          className="overview-group-link"
          title={`مشاهده جدول کامل قیمت ${category.label}`}
        >
          <strong>قیمت {category.label}</strong>
        </a>
      </td>
      <td className="overview-cell-types">
        <span>
          {groupingCountLabel(category)} · {formatCatalogNumber(category.filters.sizes.length)} سایز
        </span>
      </td>
      <td className="overview-cell-price">
        {hasRange ? (
          <span className="price-range" dir="rtl">
            {formatCatalogNumber(category.summary.min)} تا{" "}
            {formatCatalogNumber(category.summary.max)} <small>تومان</small>
          </span>
        ) : (
          <span className="price-call">تماس بگیرید</span>
        )}
      </td>
      <td className="overview-cell-unit">
        <span>{pricingState.units.length === 1 ? pricingState.units[0] : "متفاوت"}</span>
      </td>
      <td className="overview-cell-status">
        <span className={`overview-status-badge is-${category.summary.status}`}>
          {trend.amount
            ? `${trend.direction} (${formatCatalogNumber(trend.amount, 2)}٪)`
            : trend.direction}
        </span>
      </td>
      <td className="overview-cell-action">
        <a
          href={href}
          className="overview-action-link"
          aria-label={`مشاهده جدول قیمت و مشخصات ${category.label}`}
        >
          مشاهده جدول {category.label}
        </a>
      </td>
    </tr>
  );
}

function CategoryOverviewCard({
  groupId,
  category,
}: {
  groupId: ProductGroupId;
  category: CatalogCategory;
}) {
  const href = `/${groupId}/${category.id}/`;
  const pricingState = getCategoryPricingState(category);
  const hasRange = hasDisplayablePriceRange(pricingState, category.summary);

  return (
    <article className="overview-card">
      <div className="overview-card-header">
        <div>
          <h4>
            <a href={href}>قیمت {category.label}</a>
          </h4>
          <p>{groupingCountLabel(category)} · {formatCatalogNumber(category.filters.sizes.length)} سایز</p>
        </div>
      </div>
      <div className="overview-card-details">
        <div className="overview-card-price">
          <small>حدود قیمت:</small>
          {hasRange ? (
            <strong>
              {formatCatalogNumber(category.summary.min)} تا{" "}
              {formatCatalogNumber(category.summary.max)} تومان
            </strong>
          ) : (
            <strong>تماس بگیرید</strong>
          )}
        </div>
        <a href={href} className="overview-card-btn">
          مشاهده جدول کامل
        </a>
      </div>
    </article>
  );
}

function CategoryOverviewContent({
  groupId,
  catalog,
}: {
  groupId: ProductGroupId;
  catalog: GroupCatalog;
}) {
  const group = getCategoryById(groupId);

  return (
    <div className="steel-price-overview" id="category-overview">
      <div className="overview-header-info">
        <h3>انواع {catalog.label}</h3>
        <p>
          {group?.intro ??
            `دسته‌بندی‌های ${catalog.label} به همراه بازه قیمت روز هر نوع. برای مشاهده جدول کامل کارخانه‌ها، سایزها و استعلام لحظه‌ای، روی هر ردیف کلیک کنید.`}
        </p>
      </div>

      <div className="overview-table-wrapper">
        <table
          className="overview-table"
          aria-label={`جدول خلاصه قیمت انواع ${catalog.label}`}
        >
          <thead>
            <tr>
              <th scope="col">نوع {catalog.label}</th>
              <th scope="col">تعداد کارخانه/گرید و سایز</th>
              <th scope="col">حدود قیمت روز</th>
              <th scope="col">واحد</th>
              <th scope="col">وضعیت بازار</th>
              <th scope="col">دسترسی و استعلام</th>
            </tr>
          </thead>
          <tbody>
            {catalog.categories.map((category) => (
              <CategoryOverviewRow key={category.id} groupId={groupId} category={category} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="overview-mobile-cards" role="group" aria-label={`فهرست انواع ${catalog.label}`}>
        {catalog.categories.map((category) => (
          <CategoryOverviewCard key={category.id} groupId={groupId} category={category} />
        ))}
      </div>

      {categoryGuideLinks[groupId] ? (
        <aside className="overview-guide-links" aria-label={`راهنماهای تخصصی ${catalog.label}`}>
          <span className="overview-guide-title">راهنماهای فنی و جداول وزن مرتبط:</span>
          <div className="overview-guide-items">
            {categoryGuideLinks[groupId]?.map((guide) => (
              <a key={guide.href} href={guide.href} className="overview-guide-link">
                <span aria-hidden="true">📖</span>
                <span>{guide.label}</span>
              </a>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}

const categoryGuideLinks: Partial<
  Record<ProductGroupId, { href: string; label: string }[]>
> = {
  rebar: [
    { href: "/guide/rebar-weight-chart/", label: "جدول وزن میلگرد" },
    { href: "/guide/ribbed-vs-plain-rebar/", label: "تفاوت میلگرد آجدار و ساده" },
  ],
  beam: [
    { href: "/guide/beam-weight-chart/", label: "جدول وزن تیرآهن IPE" },
    { href: "/guide/ipe-vs-hash-beam/", label: "راهنمای انواع تیرآهن و هاش" },
  ],
};

export function CategoryOverview({
  groupId,
}: {
  groupId: ProductGroupId;
}) {
  const state = useCatalogData(loadGroupCatalog, groupId);
  const group = getCategoryById(groupId);

  if (state.status !== "ready") {
    return (
      <CatalogLoadMessage
        status={state.status}
        subject={`قیمت ${group?.label ?? "این گروه"}`}
      />
    );
  }

  return <CategoryOverviewContent groupId={groupId} catalog={state.data} />;
}
