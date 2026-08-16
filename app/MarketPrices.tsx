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
        <span aria-hidden="true">{trend.symbol}</span>
        <span>{trend.direction}</span>
        {trend.amount ? <span>{formatPercent(trend.amount)}٪</span> : null}
      </p>
      <p className="market-price-updated">
        بروزرسانی: <b>{formatUpdatedAt(item.updatedAt)}</b>
      </p>
    </article>
  );
}

export function MarketPrices() {
  const state = useMarketPrices();

  return (
    <section
      className="market-prices section"
      id="market-prices"
      aria-labelledby="market-prices-title"
    >
      <div className="shell">
        <div className="section-heading market-prices-heading">
          <span>نرخ لحظه‌ای بازار</span>
          <h2 id="market-prices-title">طلا، ارز و تتر</h2>
        </div>

        {state.status === "loading" ? (
          <p className="market-prices-state" role="status" aria-live="polite">
            در حال دریافت نرخ‌های بازار…
          </p>
        ) : null}

        {state.status === "unavailable" ? (
          <p className="market-prices-state" role="alert">
            نرخ‌های بازار در حال حاضر در دسترس نیست. قیمت مقاطع فولادی در بخش
            زیر همچنان در دسترس است.
          </p>
        ) : null}

        {state.status === "ready" ? (
          <>
            <div className="market-prices-grid">
              {state.data.items.map((item) => (
                <MarketPriceCard item={item} key={item.id} />
              ))}
            </div>
            <p className="market-prices-checked" role="status">
              نرخ‌ها هر ۵ دقیقه به‌روزرسانی می‌شوند · آخرین بررسی:{" "}
              <b>{formatCheckedAt(state.data.fetchedAt)}</b>
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}

export default MarketPrices;
