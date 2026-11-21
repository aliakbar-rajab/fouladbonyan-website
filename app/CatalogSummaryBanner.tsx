import { useMemo } from "react";
import { getTrendPresentation } from "./catalog-behavior.mjs";
import {
  categoryCredibleSummary,
  categoryPricingState,
  hasDisplayablePriceRange,
} from "./catalog-pricing.mjs";
import type { CatalogCategory } from "./catalog-types";
import { ContactLink } from "./ContactLink";
import { formatPersianNumber, toPersianDigits } from "./persian-numbers.mjs";
import { presentPrice } from "./catalog-presentation";
import { QUOTE_FORM_HREF } from "./quote-handoff";
import { siteConfig } from "./site-config";

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
}: {
  category: CatalogCategory;
  fetchedAt: string;
  taxIncluded: boolean;
  taxRate: number;
}) {
  const summaryPrice = (price: number) =>
    presentPrice(price, { taxIncluded, taxRate }).text;
  const trend = getTrendPresentation(
    category.summary.status,
    category.summary.percent,
  );
  const pricingState = useMemo(
    () => categoryPricingState(category),
    [category],
  );

  /*
   * The headline numbers come from the category's credible rows rather than
   * from `category.summary`, which is faithful to every upstream row and so
   * inherits their mistakes. One placeholder-priced ribbed rebar row (1,400
   * تومان/kg against a 75,100 median) was enough to publish «در بازه‌ای بین
   * ۱٬۵۰۰ تا ۹۱٬۵۰۰ تومان» as this page's first sentence. The row itself still
   * shows its real price in the table below; only the aggregate ignores it.
   *
   * Date and movement stay on `category.summary`: neither is distorted by a
   * single row's price.
   */
  const summary = useMemo(
    () => categoryCredibleSummary(category),
    [category],
  );

  return (
    <section
      className="rebar-summary"
      aria-labelledby={`catalog-price-title-${category.id}`}
    >
      <h3 id={`catalog-price-title-${category.id}`}>
        قیمت {category.label}
      </h3>
      {!pricingState.hasPrices ? (
        <div className="zero-price-inquiry-card" role="region" aria-label={`استعلام فوری ${category.label}`}>
          <p>
            قیمت عددی {category.label} امروز اعلام نشده است. برای استعلام قیمت
            روز، موجودی ضخامت/سایز و ثبت سفارش با واحد فروش تماس بگیرید یا
            درخواست پیش‌فاکتور ثبت کنید.
          </p>
          <div className="zero-price-actions">
            <ContactLink className="zero-price-btn is-primary">
              تماس فوری با فروش ({siteConfig.contact.phones[0].label})
            </ContactLink>
            <a
              href={siteConfig.contact.whatsappCommunityUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="zero-price-btn"
            >
              استعلام در واتساپ
            </a>
            <a href={QUOTE_FORM_HREF} className="zero-price-btn">
              درخواست پیش‌فاکتور {category.label}
            </a>
          </div>
        </div>
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
          بین <b>{summaryPrice(summary.min)}</b> تا{" "}
          <b>{summaryPrice(summary.max)}</b> تومان
          {taxIncluded
            ? " (با احتساب ارزش افزوده) "
            : " (بدون احتساب ارزش افزوده) "}
          قرار دارد.
        </p>
      )}
      {hasDisplayablePriceRange(pricingState, summary) ? (
        <div className="rebar-stats">
          <article className="is-max">
            <StatMarker type="max" />
            <span>بیشترین قیمت</span>
            <strong>{summaryPrice(summary.max)}</strong>
            <small>تومان</small>
          </article>
          <article className="is-min">
            <StatMarker type="min" />
            <span>کمترین قیمت</span>
            <strong>{summaryPrice(summary.min)}</strong>
            <small>تومان</small>
          </article>
          <article className="is-change">
            <StatMarker type="change" />
            <span>میزان نوسان روزانه</span>
            <strong>
              {trend.direction}
              {trend.amount
                ? ` ${formatPersianNumber(trend.amount, 2)}٪`
                : ""}
            </strong>
            <small>نسبت به روز قبل</small>
          </article>
          <article className="is-average">
            <StatMarker type="average" />
            <span>میانگین قیمت بازار</span>
            <strong>{summaryPrice(summary.average)}</strong>
            <small>تومان</small>
          </article>
        </div>
      ) : null}
    </section>
  );
}
