import { getTrendPresentation } from "./catalog-behavior.mjs";
import { hasDisplayablePriceRange } from "./catalog-pricing.mjs";
import type { CatalogCategory } from "./catalog-types";
import { displayPrice, formatCatalogNumber } from "./catalog-utils";
import { toPersianDigits } from "./persian-numbers.mjs";

function StatMarker({ type }: { type: "max" | "min" | "change" | "average" }) {
  return (
    <span className={`rebar-stat-marker is-${type}`} aria-hidden="true" />
  );
}

export function CatalogSummaryBanner({
  category,
  fetchedAt,
  taxIncluded,
  taxRate,
  pricingState,
}: {
  category: CatalogCategory;
  fetchedAt: string;
  taxIncluded: boolean;
  taxRate: number;
  pricingState: { hasPrices: boolean; units: string[] };
}) {
  const summaryPrice = (price: number) =>
    displayPrice(price, taxIncluded, taxRate);

  return (
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
          <time dateTime={fetchedAt}>
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
      {hasDisplayablePriceRange(pricingState, category.summary) ? (
        <div className="rebar-stats">
          <article className="is-max">
            <StatMarker type="max" />
            <span>بیشترین قیمت</span>
            <strong>{summaryPrice(category.summary.max)}</strong>
            <small>تومان</small>
          </article>
          <article className="is-min">
            <StatMarker type="min" />
            <span>کمترین قیمت</span>
            <strong>{summaryPrice(category.summary.min)}</strong>
            <small>تومان</small>
          </article>
          <article className="is-change">
            <StatMarker type="change" />
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
            <StatMarker type="average" />
            <span>میانگین قیمت بازار</span>
            <strong>{summaryPrice(category.summary.average)}</strong>
            <small>تومان</small>
          </article>
        </div>
      ) : null}
    </section>
  );
}
