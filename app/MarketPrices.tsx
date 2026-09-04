import { getTrendPresentation } from "./catalog-behavior.mjs";
import { EurIcon, GoldIcon, TetherIcon, UsdIcon, type IconProps } from "./icons";
import { useMarketPrices, type MarketPriceItem } from "./use-market-prices";

const ASSET_ICONS: Record<string, (props: IconProps) => ReturnType<typeof GoldIcon>> = {
  gold: GoldIcon,
  usd: UsdIcon,
  tether: TetherIcon,
  eur: EurIcon,
};

const updatedAtFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

const checkedAtFormatter = new Intl.DateTimeFormat("fa-IR", {
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

function formatPrice(value: number) {
  return value.toLocaleString("fa-IR");
}

function formatPercent(value: number) {
  return value.toLocaleString("fa-IR", { maximumFractionDigits: 2 });
}

function formatUpdatedAt(iso: string) {
  return updatedAtFormatter.format(new Date(iso));
}

function formatCheckedAt(iso: string) {
  return checkedAtFormatter.format(new Date(iso));
}

function MarketPriceCard({ item }: { item: MarketPriceItem }) {
  const trend = getTrendPresentation(item.status, item.percent);
  const Icon = ASSET_ICONS[item.id] ?? GoldIcon;
  return (
    <article className={`market-price-card is-${item.status}`}>
      <header>
        <span className="market-price-icon" aria-hidden="true">
          <Icon />
        </span>
        <h3>{item.label}</h3>
      </header>
      <p className="market-price-value">
        <strong>{formatPrice(item.price)}</strong>
        <small>{item.unit}</small>
      </p>
      <p className="market-price-trend">
        <span>{trend.direction}</span>
        {trend.amount ? <span>{formatPercent(trend.amount)}٪</span> : null}
      </p>
      <p className="market-price-updated">
        به‌روزرسانی:{" "}
        <b>
          <time dateTime={item.updatedAt}>{formatUpdatedAt(item.updatedAt)}</time>
        </b>
      </p>
    </article>
  );
}

export function MarketPrices() {
  const state = useMarketPrices();
  const isStatusOnly = state.status !== "ready";

  return (
    <section
      className={`market-prices market-context section${isStatusOnly ? " is-status-only" : ""}`}
      id="market-prices"
      aria-labelledby="market-prices-title"
    >
      <div className="shell">
        {state.status === "ready" ? (
          <>
            <div className="section-heading market-prices-heading">
              <h2 id="market-prices-title">زمینه بازار، کنار قیمت فولاد</h2>
              <p>
                نرخ طلا، ارز و تتر برای خوانش بهتر فضای بازار؛ مرجع اصلی خرید در
                جدول‌های تخصصی قیمت فولاد پایین‌تر است.
              </p>
            </div>
            <div className="market-prices-grid">
              {state.data.items.map((item) => (
                <MarketPriceCard item={item} key={item.id} />
              ))}
            </div>
            <p className="market-prices-checked" role="status">
              {state.isStale
                ? "نمایش آخرین نرخ معتبر · زمان دریافت: "
                : "نرخ‌ها هر ۵ دقیقه به‌روزرسانی می‌شوند · آخرین بررسی: "}
              <b>
                <time dateTime={state.data.fetchedAt}>
                  {formatCheckedAt(state.data.fetchedAt)}
                </time>
              </b>
              {state.isStale ? (
                <button type="button" onClick={state.retry}>
                  به‌روزرسانی دوباره
                </button>
              ) : null}
            </p>
          </>
        ) : (
          <h2 id="market-prices-title" className="sr-only">
            زمینه بازار، کنار قیمت فولاد
          </h2>
        )}

        {state.status === "loading" ? (
          <div className="market-status-rail" role="status" aria-live="polite">
            <span className="market-status-dot is-loading" aria-hidden="true" />
            <div>
              <p className="market-status-title">در حال دریافت زمینه بازار</p>
              <p>جدول قیمت فولاد آماده است و پایین‌تر در دسترس شماست.</p>
            </div>
            <a href="#price-workspace">مشاهده قیمت فولاد</a>
          </div>
        ) : null}

        {state.status === "unavailable" ? (
          <div className="market-status-rail" role="alert">
            <span className="market-status-dot is-unavailable" aria-hidden="true" />
            <div>
              <p className="market-status-title">نرخ‌های مکمل بازار دریافت نشد</p>
              <p>قیمت مقاطع فولادی مستقل از این سرویس و همچنان در دسترس است.</p>
            </div>
            <div className="market-status-actions">
              <button type="button" onClick={state.retry}>
                تلاش دوباره
              </button>
              <a href="#price-workspace">مشاهده قیمت فولاد</a>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default MarketPrices;
