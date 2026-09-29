import { validateMarketPriceData } from "../../app/market-price-validation.mjs";

// Cloudflare Pages Function, served same-origin at /api/market-prices.
// Runs at *request* time (not build time), so it can genuinely refresh
// without a redeploy -- the piece the previous build-time-JSON approach
// could not provide. The browser never talks to tgju.org directly.

const UPSTREAM_URL = "https://call4.tgju.org/ajax.json";
const UPSTREAM_TIMEOUT_MS = 8_000;
const FRESH_MAX_AGE_SECONDS = 5 * 60;
// Last-known-good fallback, served only when a live upstream fetch fails.
// Long-lived on purpose: this is the only thing standing between a tgju
// outage and an "unavailable" state, so it should outlast any reasonably
// short outage.
const FALLBACK_MAX_AGE_SECONDS = 24 * 60 * 60;

const ITEMS = [
  { id: "gold", key: "geram18", label: "طلای ۱۸ عیار", unit: "تومان / گرم" },
  { id: "usd", key: "price_dollar_rl", label: "دلار آمریکا", unit: "تومان" },
  { id: "tether", key: "crypto-tether-irr", label: "تتر", unit: "تومان" },
  { id: "eur", key: "price_eur", label: "یورو", unit: "تومان" },
];

function toIsoInstant(ts) {
  if (!ts) return null;
  // ts arrives as "YYYY-MM-DD HH:mm:ss" in Tehran local time with no offset.
  const parsed = new Date(`${ts.replace(" ", "T")}+03:30`);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function toStatus(dt) {
  if (dt === "high") return "up";
  if (dt === "low") return "down";
  return "same";
}

function toNumber(raw) {
  const numeric = Number(String(raw ?? "").replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

async function fetchFromUpstream() {
  const response = await fetch(UPSTREAM_URL, {
    headers: {
      accept: "application/json,text/plain,*/*",
      "accept-language": "fa-IR,fa;q=0.9",
      "user-agent": "Bonyan-Foulad-Daria/1.0 (+https://fouladbonyan.com/)",
    },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`tgju.org: HTTP ${response.status}`);
  }
  const body = await response.json();
  const current = body?.current;
  if (!current || typeof current !== "object") {
    throw new Error("ساختار داده tgju.org معتبر نیست.");
  }

  // tgju.org publishes rial figures; the rest of the site quotes toman
  // throughout, so every price is converted (rial / 10) here.
  const fetchedAt = new Date().toISOString();
  const payload = {
    fetchedAt,
    sourceName: "tgju.org",
    sourceUrl: "https://www.tgju.org/",
    items: ITEMS.map(({ id, key, label, unit }) => {
      const entry = current[key];
      if (!entry) {
        throw new Error(`داده ${label} در پاسخ tgju.org پیدا نشد.`);
      }
      const rial = toNumber(entry.p);
      if (!rial || rial <= 0) {
        throw new Error(`قیمت ${label} معتبر نیست.`);
      }
      const percent = toNumber(entry.dp);
      if (percent === null) {
        throw new Error(`درصد تغییر ${label} معتبر نیست.`);
      }
      return {
        id,
        label,
        unit,
        price: Math.round(rial / 10),
        status: toStatus(entry.dt),
        percent: Math.abs(percent),
        updatedAt: toIsoInstant(entry.ts) ?? fetchedAt,
      };
    }),
  };

  // Never let a malformed or implausible upstream shape reach a client as
  // if it were a real price -- this is the same schema gate the previous
  // build-time script used, just running at request time now.
  validateMarketPriceData(payload);
  return payload;
}

function jsonResponse(payload, maxAgeSeconds, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": `public, max-age=${maxAgeSeconds}`,
      ...extraHeaders,
    },
  });
}

export async function onRequestGet({ request, waitUntil }) {
  const cache = caches.default;
  const origin = new URL(request.url).origin;
  // Two independent edge cache entries on the same route: a short-lived
  // "fresh" copy (what most requests hit) and a long-lived "last good" copy
  // that is only ever read on an upstream failure. Keeping them as separate
  // keys means the fallback survives well past the 5-minute fresh window.
  const freshKey = new Request(`${origin}/api/market-prices`);
  const fallbackKey = new Request(`${origin}/api/market-prices?cache=fallback`);

  const freshHit = await cache.match(freshKey);
  if (freshHit) return freshHit;

  try {
    const payload = await fetchFromUpstream();
    const response = jsonResponse(payload, FRESH_MAX_AGE_SECONDS);
    waitUntil(cache.put(freshKey, response.clone()));
    waitUntil(
      cache.put(fallbackKey, jsonResponse(payload, FALLBACK_MAX_AGE_SECONDS)),
    );
    return response;
  } catch (error) {
    const fallbackHit = await cache.match(fallbackKey);
    if (fallbackHit) {
      const payload = await fallbackHit.json();
      return jsonResponse(payload, 0, {
        "cache-control": "no-store",
        "x-market-prices-fallback": "true",
      });
    }
    // Never seen a valid response, ever, from this edge location -- report
    // unavailable rather than inventing a price.
    return new Response(
      JSON.stringify({
        error: "market prices unavailable",
        message: String(error?.message ?? error),
      }),
      {
        status: 503,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      },
    );
  }
}
