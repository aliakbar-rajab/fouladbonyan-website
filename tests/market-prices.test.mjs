import assert from "node:assert/strict";
import test from "node:test";
import { validateMarketPriceData } from "../app/market-price-validation.mjs";
import {
  createMarketPricesHandler,
  onRequestGet,
} from "../functions/api/market-prices.js";

const BASE_TIME = Date.parse("2026-08-05T12:00:00.000Z");
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;

function createClock(initialMs = BASE_TIME) {
  let current = initialMs;
  return {
    now: () => current,
    advance(ms) {
      current += ms;
    },
  };
}

function parseMaxAgeMs(response) {
  const header = response.headers.get("cache-control") ?? "";
  const match = header.match(/max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : 0;
}

function createMemoryCache({ now }) {
  const entries = new Map();
  return {
    entries,
    async match(key) {
      const url = typeof key === "string" ? key : key.url;
      const entry = entries.get(url);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(url);
        return undefined;
      }
      return entry.response.clone();
    },
    async put(key, response) {
      const url = typeof key === "string" ? key : key.url;
      const ttlMs = parseMaxAgeMs(response);
      if (ttlMs <= 0) {
        entries.delete(url);
        return;
      }
      entries.set(url, {
        response: response.clone(),
        expiresAt: now() + ttlMs,
      });
    },
  };
}

function upstreamBody(overrides = {}) {
  return {
    current: {
      geram18: {
        p: "45,123,456",
        dp: "1.25",
        dt: "high",
        ts: "2026-08-05 15:25:00",
      },
      price_dollar_rl: {
        p: "600,000",
        dp: "-0.75",
        dt: "low",
        ts: "2026-08-05 15:26:00",
      },
      "crypto-tether-irr": {
        p: "601,500",
        dp: "0",
        dt: "",
        ts: "not-a-timestamp",
      },
      price_eur: {
        p: "650,000",
        dp: "0.4",
        dt: "high",
      },
      ...overrides,
    },
  };
}

function validPayload() {
  return {
    fetchedAt: "2026-08-05T12:00:00.000Z",
    sourceName: "tgju.org",
    sourceUrl: "https://www.tgju.org/",
    items: [
      {
        id: "gold",
        label: "طلای ۱۸ عیار",
        unit: "تومان / گرم",
        price: 4_512_346,
        status: "up",
        percent: 1.25,
        updatedAt: "2026-08-05T11:55:00.000Z",
      },
      {
        id: "usd",
        label: "دلار آمریکا",
        unit: "تومان",
        price: 60_000,
        status: "down",
        percent: 0.75,
        updatedAt: "2026-08-05T11:56:00.000Z",
      },
      {
        id: "tether",
        label: "تتر",
        unit: "تومان",
        price: 60_150,
        status: "same",
        percent: 0,
        updatedAt: "2026-08-05T12:00:00.000Z",
      },
      {
        id: "eur",
        label: "یورو",
        unit: "تومان",
        price: 65_000,
        status: "up",
        percent: 0.4,
        updatedAt: "2026-08-05T12:00:00.000Z",
      },
    ],
  };
}

async function callHandler(handler, url = "https://fouladbonyan.com/api/market-prices") {
  const pending = [];
  const response = await handler({
    request: new Request(url),
    waitUntil: (promise) => pending.push(promise),
  });
  await Promise.all(pending);
  return response;
}

test("validateMarketPriceData accepts a valid four-instrument payload", () => {
  const payload = validPayload();
  assert.strictEqual(validateMarketPriceData(payload), payload);
});

test("validateMarketPriceData rejects malformed envelopes, item counts, and item fields", () => {
  const mutate = (fn) => {
    const copy = structuredClone(validPayload());
    fn(copy);
    return copy;
  };

  const invalidCases = [
    null,
    [],
    "not an object",
    mutate((p) => { p.fetchedAt = "not-a-date"; }),
    mutate((p) => { p.sourceName = "   "; }),
    mutate((p) => { p.sourceUrl = "http://www.tgju.org/"; }),
    mutate((p) => { p.items = "not-an-array"; }),
    mutate((p) => { p.items.pop(); }),
    mutate((p) => { p.items.push({ ...p.items[0], id: "extra" }); }),
    mutate((p) => { p.items.reverse(); }),
    mutate((p) => { p.items[0] = null; }),
    mutate((p) => { p.items[0].label = ""; }),
    mutate((p) => { p.items[0].unit = "  "; }),
    mutate((p) => { p.items[0].price = 0; }),
    mutate((p) => { p.items[0].price = -100; }),
    mutate((p) => { p.items[0].price = Number.NaN; }),
    mutate((p) => { delete p.items[0].price; }),
    mutate((p) => { p.items[0].status = "unknown"; }),
    mutate((p) => { p.items[0].percent = -1; }),
    mutate((p) => { p.items[0].updatedAt = "bad-date"; }),
  ];

  for (const sample of invalidCases) {
    assert.throws(
      () => validateMarketPriceData(sample),
      /داده قیمت نامعتبر است/,
    );
  }
});

test("createMarketPricesHandler requires a cache adapter", () => {
  assert.throws(
    () => createMarketPricesHandler({}),
    /cache adapter/i,
  );
});

test("cold cache miss fetches, transforms, validates, and populates fresh + fallback caches", async () => {
  const clock = createClock();
  const cache = createMemoryCache(clock);
  let fetchCalls = 0;
  let capturedRequest = null;

  const handler = createMarketPricesHandler({
    cache,
    now: clock.now,
    fetch: async (url, init) => {
      fetchCalls += 1;
      capturedRequest = { url, init };
      return Response.json(upstreamBody());
    },
  });

  const response = await callHandler(handler);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=300");
  assert.equal(response.headers.get("x-market-prices-fallback"), null);
  assert.equal(fetchCalls, 1);
  assert.equal(capturedRequest.url, "https://call4.tgju.org/ajax.json");
  assert.ok(capturedRequest.init.signal instanceof AbortSignal);

  const body = await response.json();
  assert.equal(body.fetchedAt, "2026-08-05T12:00:00.000Z");
  assert.deepEqual(
    body.items.map(({ id, price, status, percent, updatedAt }) => ({
      id,
      price,
      status,
      percent,
      updatedAt,
    })),
    [
      {
        id: "gold",
        price: 4_512_346,
        status: "up",
        percent: 1.25,
        updatedAt: "2026-08-05T11:55:00.000Z",
      },
      {
        id: "usd",
        price: 60_000,
        status: "down",
        percent: 0.75,
        updatedAt: "2026-08-05T11:56:00.000Z",
      },
      {
        id: "tether",
        price: 60_150,
        status: "same",
        percent: 0,
        updatedAt: "2026-08-05T12:00:00.000Z",
      },
      {
        id: "eur",
        price: 65_000,
        status: "up",
        percent: 0.4,
        updatedAt: "2026-08-05T12:00:00.000Z",
      },
    ],
  );

  // Warm hit within the 5-minute fresh window skips upstream entirely.
  clock.advance(4 * MINUTE_MS);
  const cachedResponse = await callHandler(handler);
  assert.equal(cachedResponse.status, 200);
  assert.equal(fetchCalls, 1);
  assert.deepEqual(await cachedResponse.json(), body);

  // Once the fresh entry expires, upstream is queried again and caches refresh.
  clock.advance(2 * MINUTE_MS);
  const refreshedResponse = await callHandler(handler);
  assert.equal(refreshedResponse.status, 200);
  assert.equal(fetchCalls, 2);
  assert.equal(
    (await refreshedResponse.json()).fetchedAt,
    "2026-08-05T12:06:00.000Z",
  );
});

test("upstream failure serves cached fallback past fresh expiry and returns 503 once fallback expires", async () => {
  const clock = createClock();
  const cache = createMemoryCache(clock);
  let mode = "ok";

  const handler = createMarketPricesHandler({
    cache,
    now: clock.now,
    fetch: async () => {
      if (mode === "ok") return Response.json(upstreamBody());
      if (mode === "http500") return new Response("boom", { status: 500 });
      if (mode === "malformed") return Response.json({ current: { geram18: { p: "0", dp: "0" } } });
      throw new Error("network unreachable");
    },
  });

  // Prime fresh + fallback caches.
  const initial = await callHandler(handler);
  assert.equal(initial.status, 200);
  const initialPayload = await initial.json();

  // Expire the 5-minute fresh cache; fallback (24h) still lives.
  clock.advance(10 * MINUTE_MS);

  for (const failureMode of ["http500", "malformed", "network"]) {
    mode = failureMode;
    const fallbackResponse = await callHandler(handler);
    assert.equal(fallbackResponse.status, 200, `expected fallback for ${failureMode}`);
    assert.equal(fallbackResponse.headers.get("cache-control"), "no-store");
    assert.equal(fallbackResponse.headers.get("x-market-prices-fallback"), "true");
    assert.deepEqual(await fallbackResponse.json(), initialPayload);
  }

  // Expire the 24-hour fallback cache too -> 503 unavailable.
  clock.advance(25 * HOUR_MS);
  mode = "network";
  const unavailable = await callHandler(handler);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
  const errorBody = await unavailable.json();
  assert.equal(errorBody.error, "market prices unavailable");
  assert.match(errorBody.message, /network unreachable/);
});

test("cold cache upstream failure or invalid upstream payload returns 503 without caching bad data", async () => {
  const clock = createClock();
  const cache = createMemoryCache(clock);

  const handler = createMarketPricesHandler({
    cache,
    now: clock.now,
    fetch: async () =>
      Response.json(upstreamBody({ price_eur: { p: "-10", dp: "0.2", dt: "high" } })),
  });

  const response = await callHandler(handler);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(cache.entries.size, 0);
});

test("onRequestGet Cloudflare adapter delegates through caches.default and globalThis.fetch", async () => {
  const originalFetch = globalThis.fetch;
  const originalCaches = globalThis.caches;
  const clock = createClock();
  const memoryCache = createMemoryCache(clock);
  const pending = [];

  globalThis.caches = { default: memoryCache };
  globalThis.fetch = async () => Response.json(upstreamBody());
  try {
    const response = await onRequestGet({
      request: new Request("https://fouladbonyan.com/api/market-prices"),
      waitUntil: (promise) => pending.push(promise),
    });
    await Promise.all(pending);
    assert.equal(response.status, 200);
    assert.equal(memoryCache.entries.size, 2);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalCaches === undefined) delete globalThis.caches;
    else globalThis.caches = originalCaches;
  }
});
