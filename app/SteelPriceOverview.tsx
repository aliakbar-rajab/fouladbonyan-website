import { useEffect, useState } from "react";
import {
  buildFallbackOverviews,
  loadOverviewSummaries,
  type CategoryPriceOverview,
} from "./catalog-reader";
import { formatCatalogNumber } from "./catalog-utils";
import { getTrendPresentation } from "./catalog-behavior.mjs";
import { getThumbnailSources } from "./image-utils";

function formatStatusText(status: string, percent: number): string {
  const trend = getTrendPresentation(status, percent);
  if (!trend.amount) return trend.direction;
  return `${trend.direction} (${formatCatalogNumber(trend.amount, 1)}٪)`;
}

export function SteelPriceOverview({ phoneHref }: { phoneHref: string }) {
  const initialSummaries = loadOverviewSummaries.getCached();
  const [summaries, setSummaries] = useState<CategoryPriceOverview[]>(
    () => initialSummaries ?? buildFallbackOverviews(),
  );
  const [loaded, setLoaded] = useState(() => initialSummaries !== undefined);

  useEffect(() => {
    if (initialSummaries !== undefined) return;
    let active = true;
    loadOverviewSummaries()
      .then((data) => {
        if (active) {
          setSummaries(data);
          setLoaded(true);
        }
      })
      .catch(() => {
        // Fallback summaries remain visible
      });
    return () => {
      active = false;
    };
  }, [initialSummaries]);


  return (
    <div className="steel-price-overview" id="overview-table">
      <div className="overview-header-info">
        <div className="overview-command-status" role="status">
          <span aria-hidden="true" />
          {loaded ? "داده‌های جاری قیمت سایت" : "در حال دریافت داده‌های جاری"}
        </div>
        <h3>نمای کلی قیمت روز آهن‌آلات و مقاطع فولادی</h3>
        <p>
          جدول زیر میانگین و دامنه قیمت روز دسته‌های اصلی بازار آهن را نمایش
          می‌دهد. برای مشاهده جدول تفکیکی کارخانه‌ها، سایزها و استعلام لحظه‌ای،
          روی ردیف هر محصول کلیک کنید.
        </p>
      </div>

      <div className="overview-table-wrapper">
        <table
          className="overview-table"
          aria-label="جدول خلاصه قیمت روز آهن و مقاطع فولادی"
        >
          <thead>
            <tr>
              <th scope="col">گروه محصول</th>
              <th scope="col">انواع و استانداردهای اصلی</th>
              <th scope="col">حدود قیمت روز</th>
              <th scope="col">واحد</th>
              <th scope="col">وضعیت بازار</th>
              <th scope="col">دسترسی و استعلام</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((item) => {
              const thumbs = getThumbnailSources(item.image);
              return (
                <tr key={item.id} className="overview-row">
                  <td className="overview-cell-group">
                    <a
                      href={`/${item.id}/`}
                      className="overview-group-link"
                      title={`مشاهده جدول کامل قیمت ${item.label}`}
                    >
                      <picture className="overview-thumb-picture">
                        <source type="image/avif" srcSet={thumbs.avif} />
                        <source type="image/webp" srcSet={thumbs.webp} />
                        <img
                          src={thumbs.jpg}
                          alt=""
                          width="40"
                          height="40"
                          loading="lazy"
                          decoding="async"
                          className="overview-thumb"
                        />
                      </picture>
                      <strong>قیمت {item.label}</strong>
                    </a>
                  </td>
                  <td className="overview-cell-types">
                    <span>{item.subTypes}</span>
                  </td>
                  <td className="overview-cell-price">
                    {item.priceRanges.length ? (
                      <span className="price-range-group">
                        {item.priceRanges.map((range) => (
                          <span
                            className="price-range"
                            dir="rtl"
                            key={range.unit}
                          >
                            {formatCatalogNumber(range.min)} تا{" "}
                            {formatCatalogNumber(range.max)}{" "}
                            <small>تومان / {range.unit}</small>
                          </span>
                        ))}
                      </span>
                    ) : loaded ? (
                      <span className="price-call">تماس بگیرید</span>
                    ) : (
                      <span className="price-loading">در حال به‌روزرسانی…</span>
                    )}
                  </td>
                  <td className="overview-cell-unit">
                    <span>
                      {item.priceRanges.map((range) => range.unit).join(" / ") ||
                        "—"}
                    </span>
                  </td>
                  <td className="overview-cell-status">
                    <span
                      className={`overview-status-badge is-${item.status}`}
                    >
                      {formatStatusText(item.status, item.percent)}
                    </span>
                  </td>
                  <td className="overview-cell-action">
                    <a
                      href={`/${item.id}/`}
                      className="overview-action-link"
                      aria-label={`مشاهده جدول قیمت و مشخصات ${item.label}`}
                    >
                      مشاهده جدول {item.shortLabel}
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="overview-mobile-cards" role="group" aria-label="فهرست خلاصه قیمت‌ها">
        {summaries.map((item) => {
          const thumbs = getThumbnailSources(item.image);
          return (
            <article key={item.id} className="overview-card">
              <div className="overview-card-header">
                <picture className="overview-card-thumb-picture">
                  <source type="image/avif" srcSet={thumbs.avif} />
                  <source type="image/webp" srcSet={thumbs.webp} />
                  <img
                    src={thumbs.jpg}
                    alt=""
                    width="48"
                    height="48"
                    loading="lazy"
                    decoding="async"
                    className="overview-card-thumb"
                  />
                </picture>
                <div>
                  <h4>
                    <a href={`/${item.id}/`}>قیمت {item.label}</a>
                  </h4>
                  <p>{item.subTypes}</p>
                </div>
              </div>
              <div className="overview-card-details">
                <div className="overview-card-price">
                  <small>حدود قیمت:</small>
                  {item.priceRanges.length ? (
                    item.priceRanges.map((range) => (
                      <strong key={range.unit}>
                        {formatCatalogNumber(range.min)} تا{" "}
                        {formatCatalogNumber(range.max)} تومان
                        <span> ({range.unit})</span>
                      </strong>
                    ))
                  ) : (
                    <strong>تماس بگیرید</strong>
                  )}
                </div>
                <a href={`/${item.id}/`} className="overview-card-btn">
                  مشاهده جدول کامل
                </a>
              </div>
            </article>
          );
        })}
      </div>

      <div className="overview-footer-card">
        <div>
          <strong>نیاز به پیش‌فاکتور رسمی یا استعلام فوری دارید؟</strong>
          <p>
            کارشناسان فروش بنیان فولاد داریا آماده پاسخگویی، تأیید موجودی و اعلام
            قیمت قطعی هستند.
          </p>
        </div>
        <div className="overview-footer-actions">
          <a href="/quote-process/#quote-form" className="overview-quote-btn">
            درخواست پیش‌فاکتور
          </a>
          <a href={phoneHref} className="overview-call-btn">
            تماس با واحد فروش
          </a>
        </div>
      </div>
    </div>
  );
}
