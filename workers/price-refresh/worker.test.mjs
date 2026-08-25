import assert from "node:assert/strict";
import test from "node:test";
import worker from "./worker.mjs";
import { KV_KEYS, STATUS_KEY } from "./ingest.mjs";

function fakeKv(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

function fakeProductItem(index) {
  return {
    id: index + 1,
    title: `میلگرد ${index + 1}`,
    price: 100_000 + index,
    percent: 1,
    status: "same",
    updated_at: Math.floor(Date.now() / 1000),
    "meta-سایز": "12",
    "meta-استاندارد": "A1",
    "meta-گرید": "G1",
    "meta-طول شاخه": "12",
    "meta-حالت": "شاخه",
    "meta-وزن تقریبی": "10",
    "meta-محل تحویل": "کارخانه",
    "meta-واحد": "کیلوگرم",
    "meta-کارخانه": "کارخانه تست",
    "meta-ضخامت": "2",
    "meta-عرض": "1",
    "meta-طول": "6",
    "meta-رده": "40",
    "meta-چشمه": "5x5",
    "meta-ستون": "1",
  };
}

function fakeCatalogHtml() {
  const products = Array.from({ length: 120 }, (_, index) => fakeProductItem(index));
  const shopData = {
    title: "تست",
    products: [{ title: "کارخانه تست", productsitem: products }],
    price_compare: { date: "1404/01/01", percent: 1, status: "same" },
  };
  const nextData = { props: { pageProps: { shopData } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
}

async function buildValidPayloads(t) {
  const { buildAllPayloads } = await import("../../scripts/lib/build-price-payloads.mjs");
  t.mock.method(globalThis, "fetch", async () => new Response(fakeCatalogHtml(), { status: 200 }));
  return buildAllPayloads();
}

test("GET /catalog-prices.json serves the stored canonical snapshot", async () => {
  const env = {
    PRICE_DATA: fakeKv({ [KV_KEYS.catalog]: '{"fetchedAt":"now","catalogs":[]}' }),
  };
  const response = await worker.fetch(
    new Request("https://price.example/catalog-prices.json"),
    env,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    fetchedAt: "now",
    catalogs: [],
  });
});

test("GET /rebar-prices.json serves the stored snapshot", async () => {
  const env = { PRICE_DATA: fakeKv({ [KV_KEYS.rebar]: '{"fetchedAt":"now"}' }) };
  const response = await worker.fetch(new Request("https://price.example/rebar-prices.json"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { fetchedAt: "now" });
});

test("GET a dataset that has never been written returns 503", async () => {
  const env = { PRICE_DATA: fakeKv() };
  const response = await worker.fetch(new Request("https://price.example/beam-prices.json"), env);
  assert.equal(response.status, 503);
});

test("GET /status echoes the last recorded refresh status", async () => {
  const env = {
    PRICE_DATA: fakeKv({ [STATUS_KEY]: JSON.stringify({ ok: true, at: "t" }) }),
  };
  const response = await worker.fetch(new Request("https://price.example/status"), env);
  assert.deepEqual(await response.json(), { ok: true, at: "t" });
});

test("unknown routes return 404", async () => {
  const env = { PRICE_DATA: fakeKv() };
  const response = await worker.fetch(new Request("https://price.example/nope"), env);
  assert.equal(response.status, 404);
});

test("POST /ingest without the bearer token is rejected", async () => {
  const env = { PRICE_DATA: fakeKv(), INGEST_TOKEN: "secret" };
  const response = await worker.fetch(
    new Request("https://price.example/ingest", { method: "POST", body: "{}" }),
    env,
  );
  assert.equal(response.status, 401);
});

test("POST /ingest without a configured token is always rejected, never open", async () => {
  const env = { PRICE_DATA: fakeKv() };
  const response = await worker.fetch(
    new Request("https://price.example/ingest", {
      method: "POST",
      headers: { authorization: "Bearer anything" },
      body: "{}",
    }),
    env,
  );
  assert.equal(response.status, 401);
});

test("POST /ingest with a malformed JSON body is rejected without touching KV", async () => {
  const env = { PRICE_DATA: fakeKv(), INGEST_TOKEN: "secret" };
  const response = await worker.fetch(
    new Request("https://price.example/ingest", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
      body: "not json",
    }),
    env,
  );
  assert.equal(response.status, 400);
  assert.equal(env.PRICE_DATA.store.size, 0);
});

test("POST /ingest with a valid payload stores it and calls the deploy hook", async (t) => {
  const payloads = await buildValidPayloads(t);
  const calledUrls = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = typeof input === "string" ? input : input.url;
    calledUrls.push(url);
    return new Response("ok", { status: 200 });
  });
  const env = {
    PRICE_DATA: fakeKv(),
    INGEST_TOKEN: "secret",
    DEPLOY_HOOK_URL: "https://deploy.example/hook",
  };

  const response = await worker.fetch(
    new Request("https://price.example/ingest", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
      body: JSON.stringify(payloads),
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.ok(env.PRICE_DATA.store.has(KV_KEYS.rebar));
  assert.equal(calledUrls.includes("https://deploy.example/hook"), true);
});

// Regression for the 2026-08-25 production incident: refresh-and-publish.mjs
// (the real GitHub Actions producer) only ever sends `{ snapshot, diagnostics }`
// -- it has not sent top-level rebar/beam/product keys since the catalog
// snapshot migration (commit fc1125c). A Worker still running the pre-migration
// `validateAll`, which required `payload.rebar` to exist directly, rejected
// every real publish with "HTTP 422: payload.rebar وجود ندارد یا شیء نیست"
// even though both sides of *this* repo agreed on the contract -- the deployed
// Worker had simply never been redeployed after the producer changed. This
// pins the exact shape the producer sends so the contract can't silently drift
// again without a test failing here first.
test("POST /ingest accepts the exact { snapshot, diagnostics } shape refresh-and-publish.mjs sends, with no top-level rebar/beam/product keys", async (t) => {
  const { buildCatalogSnapshot } = await import(
    "../../scripts/lib/build-price-payloads.mjs"
  );
  t.mock.method(globalThis, "fetch", async () =>
    new Response(fakeCatalogHtml(), { status: 200 }),
  );
  const { snapshot, diagnostics } = await buildCatalogSnapshot();
  const producerPayload = { snapshot, diagnostics };

  assert.equal(producerPayload.rebar, undefined);
  assert.equal(producerPayload.beam, undefined);
  assert.equal(producerPayload.product, undefined);

  const env = { PRICE_DATA: fakeKv(), INGEST_TOKEN: "secret" };
  const response = await worker.fetch(
    new Request("https://price.example/ingest", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
      body: JSON.stringify(producerPayload),
    }),
    env,
  );

  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.ok, true);
  assert.ok(env.PRICE_DATA.store.has(KV_KEYS.catalog));
  assert.ok(env.PRICE_DATA.store.has(KV_KEYS.rebar));
  assert.ok(env.PRICE_DATA.store.has(KV_KEYS.beam));
  assert.ok(env.PRICE_DATA.store.has(KV_KEYS.product));
});

test("POST /ingest with an invalid payload does not call the deploy hook", async (t) => {
  const calledUrls = [];
  t.mock.method(globalThis, "fetch", async (input) => {
    const url = typeof input === "string" ? input : input.url;
    calledUrls.push(url);
    return new Response("ok", { status: 200 });
  });
  const env = {
    PRICE_DATA: fakeKv(),
    INGEST_TOKEN: "secret",
    DEPLOY_HOOK_URL: "https://deploy.example/hook",
  };

  const response = await worker.fetch(
    new Request("https://price.example/ingest", {
      method: "POST",
      headers: { authorization: "Bearer secret" },
      body: JSON.stringify({ rebar: {}, beam: {}, product: {} }),
    }),
    env,
  );

  assert.equal(response.status, 422);
  assert.equal(env.PRICE_DATA.store.has(KV_KEYS.rebar), false);
  assert.equal(calledUrls.includes("https://deploy.example/hook"), false);
});
