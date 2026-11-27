import { QUOTE_FORM_HREF } from "./quote-handoff";
import { subcategoryHref, type ProductGroupId } from "./category-meta";
import { useEffect, useState } from "react";
import {
  buildFallbackOverviews,
  loadOverviewSummaries,
  type CategoryPriceOverview,
} from "./catalog-reader";
import {
  PRICE_PENDING_TEXT,
  PRICE_UNAVAILABLE_TEXT,
  presentPriceMovement,
  presentPriceRange,
} from "./catalog-presentation";
import { getThumbnailSources } from "./image-utils";
import { ContactLink } from "./ContactLink";

const OVERVIEW_FLAGSHIP_SUBCATEGORY: Partial<Record<ProductGroupId, string>> = {
  rebar: "ribbed",
  sheet: "black-sheet",
  pipe: "seamless-pipe",
  profile: "box-profile",
  wire: "steel-wire",
};

const OVERVIEW_QUICK_SUBCATEGORIES: Record<
  ProductGroupId,
  readonly { id?: string; label: string }[]
> = {
  rebar: [
    { id: "ribbed", label: "میلگرد آجدار" },
    { id: "simple", label: "ساده" },
    { id: "stainless", label: "استیل" },
    { id: "alloy", label: "آلیاژی" },
  ],
  beam: [
    { label: "تیرآهن IPE" },
    { id: "hash", label: "تیرآهن هاش" },
  ],
  sheet: [
    { id: "black-sheet", label: "ورق سیاه" },
    { id: "galvanized-sheet", label: "گالوانیزه" },
    { id: "oily-sheet", label: "روغنی" },
    { id: "sheet-st52", label: "ST52" },
    { id: "sheet-a516", label: "A516" },
    { id: "sheet-ck45", label: "CK45" },
  ],
  profile: [
    { id: "box-profile", label: "قوطی آهنی" },
    { id: "building-profile", label: "ساختمانی" },
    { id: "industrial-profile", label: "صنعتی" },
    { id: "furniture-profile", label: "مبلی" },
    { id: "galvanized-profile", label: "گالوانیزه" },
  ],
  pipe: [
    { id: "seamless-pipe", label: "مانیسمان" },
    { id: "thick-wall-pipe", label: "گوشتدار" },
    { id: "scaffold-pipe", label: "داربست" },
    { id: "gas-pipe", label: "گاز" },
    { id: "galvanized-pipe", label: "گالوانیزه" },
  ],
  angle: [{ label: "نبشی فابریک و پرسی" }],
  channel: [{ label: "ناودانی سبک و سنگین" }],
  wire: [
    { id: "steel-wire", label: "سیم مفتول" },
    { id: "rib-lath", label: "رابیتس" },
    { id: "steel-mesh", label: "مش" },
    { id: "chicken-mesh", label: "توری مرغی" },
    { id: "chain-link-mesh", label: "حصاری" },
  ],
};

function overviewFlagshipHref(groupId: ProductGroupId): string {
  return subcategoryHref(groupId, OVERVIEW_FLAGSHIP_SUBCATEGORY[groupId]);
}

function OverviewQuickLinks({
  groupId,
  label,
}: {
  groupId: ProductGroupId;
  label: string;
}) {
  const links = OVERVIEW_QUICK_SUBCATEGORIES[groupId] ?? [];
  return (
    <nav className="overview-sub-links" aria-label={`زیرگروه‌های ${label}`}>
      {links.map((entry) => (
        <a
          key={`${groupId}-${entry.id ?? "root"}`}
          href={subcategoryHref(groupId, entry.id)}
          className="overview-sub-link"
        >
          {entry.label}
        </a>
      ))}
    </nav>
  );
}

/**
 * What an item with no price ranges reads.
 *
 * Before the snapshot arrives nothing is known either way, so the reader is
 * not yet told to phone. The table applied that guard and the cards did not,
 * so the two shells of this component showed different text for the same
 * empty data while the page was still loading.
 */
function emptyPriceText(loaded: boolean) {
  return loaded ? PRICE_UNAVAILABLE_TEXT : PRICE_PENDING_TEXT;
}

export function SteelPriceOverview() {
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
              const targetHref = overviewFlagshipHref(item.id);
              const movement = presentPriceMovement(item.status, item.percent);
              return (
                <tr key={item.id} className="overview-row">
                  <td className="overview-cell-group">
                    <a
                      href={targetHref}
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
                    <OverviewQuickLinks groupId={item.id} label={item.label} />
                  </td>
                  <td className="overview-cell-price">
                    {item.priceRanges.length ? (
                      <span className="price-range-group">
                        {item.priceRanges.map((range) => {
                          const price = presentPriceRange(range, {
                            unit: range.unit,
                          });
                          return (
                            <span
                              className="price-range"
                              dir="rtl"
                              key={range.unit}
                            >
                              {price.text} <small>{price.suffix}</small>
                            </span>
                          );
                        })}
                      </span>
                    ) : (
                      <span
                        className={loaded ? "price-call" : "price-loading"}
                      >
                        {emptyPriceText(loaded)}
                      </span>
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
                      className={`overview-status-badge ${movement.toneClass}`}
                    >
                      {movement.text}
                    </span>
                  </td>
                  <td className="overview-cell-action">
                    <a
                      href={targetHref}
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
          const targetHref = overviewFlagshipHref(item.id);
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
                    <a href={targetHref}>قیمت {item.label}</a>
                  </h4>
                  <OverviewQuickLinks groupId={item.id} label={item.label} />
                </div>
              </div>
              <div className="overview-card-details">
                <div className="overview-card-price">
                  <small>حدود قیمت:</small>
                  {item.priceRanges.length ? (
                    item.priceRanges.map((range) => {
                      const price = presentPriceRange(range, {
                        unit: range.unit,
                      });
                      return (
                        <strong key={range.unit}>
                          {price.text} <span>{price.suffix}</span>
                        </strong>
                      );
                    })
                  ) : (
                    <strong>{emptyPriceText(loaded)}</strong>
                  )}
                </div>
                <a href={targetHref} className="overview-card-btn">
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
          <a href={QUOTE_FORM_HREF} className="overview-quote-btn">
            درخواست پیش‌فاکتور
          </a>
          <ContactLink className="overview-call-btn">
            تماس با واحد فروش
          </ContactLink>
        </div>
      </div>
    </div>
  );
}
