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
