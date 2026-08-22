import { useEffect, useRef, useState } from "react";
import { isMarketPriceDataStale } from "./market-prices-stale";

export type MarketPriceItem = {
  id: string;
  label: string;
  unit: string;
  price: number;
  status: "up" | "down" | "same";
  percent: number;
  updatedAt: string;
};

export type MarketPriceData = {
  fetchedAt: string;
  sourceName: string;
  sourceUrl: string;
  items: MarketPriceItem[];
};

export type MarketPricesState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "ready"; data: MarketPriceData; isStale: boolean };

// Same-origin Cloudflare Pages Function (functions/api/market-prices.js).
// It fetches tgju.org server-side on every edge cache miss and keeps its
// own short (5min) and long (24h, last-known-good) caches, so this client
// never talks to tgju.org directly and never needs its own cache-busting
// query param -- adding one here would fragment the edge cache into one
// entry per request and defeat the whole point of it.
const MARKET_PRICES_URL = "/api/market-prices";
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isMarketPriceData(value: unknown): value is MarketPriceData {
  return (
    isRecord(value) &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    typeof value.fetchedAt === "string"
  );
}

export function useMarketPrices(): MarketPricesState {
  const [state, setState] = useState<MarketPricesState>({ status: "loading" });
  const lastGoodRef = useRef<MarketPriceData | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await fetch(MARKET_PRICES_URL, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!isMarketPriceData(data)) throw new Error("داده نامعتبر");
        if (!active) return;
        lastGoodRef.current = data;
        setState({
          status: "ready",
          data,
          isStale: isMarketPriceDataStale(data),
        });
      } catch {
        if (!active) return;
        const lastGood = lastGoodRef.current;
        // A request failure here (network error, non-200, malformed body)
        // does not necessarily mean tgju.org itself is down -- the
        // endpoint already serves its own last-known-good copy on an
        // upstream failure. Falling back to lastGoodRef only covers the
        // case where the endpoint itself is unreachable.
        setState(
          lastGood
            ? { status: "ready", data: lastGood, isStale: true }
            : { status: "unavailable" },
        );
      }
    };

    load();
    const intervalId = window.setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return state;
}
