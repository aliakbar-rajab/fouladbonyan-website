import assert from "node:assert/strict";
import test from "node:test";
import { ingestAll, KV_KEYS, STATUS_KEY } from "./ingest.mjs";
import { buildAllPayloads } from "../../scripts/lib/build-price-payloads.mjs";

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

// 120 rows clears every source's minimumItems (the highest is 100, for
// ribbed rebar).
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

async function buildValidPayloads(t) {
  t.mock.method(globalThis, "fetch", async () => new Response(fakeCatalogHtml(), { status: 200 }));
  return buildAllPayloads();
}

test("ingestAll stores all three datasets and a success status for a valid payload", async (t) => {
  const payloads = await buildValidPayloads(t);
  const kv = fakeKv();

  const status = await ingestAll(kv, payloads);

  assert.equal(status.ok, true);
  assert.deepEqual(JSON.parse(kv.store.get(KV_KEYS.rebar)), payloads.rebar);
  assert.deepEqual(JSON.parse(kv.store.get(KV_KEYS.beam)), payloads.beam);
  assert.deepEqual(JSON.parse(kv.store.get(KV_KEYS.product)), payloads.product);
  assert.equal(JSON.parse(kv.store.get(STATUS_KEY)).ok, true);
});

test("ingestAll rejects a payload missing a dataset and leaves KV untouched", async () => {
  const kv = fakeKv({ [KV_KEYS.rebar]: '{"fetchedAt":"old"}' });

  const status = await ingestAll(kv, { rebar: { fetchedAt: "x" }, beam: { fetchedAt: "x" } });

  assert.equal(status.ok, false);
  assert.match(status.error, /داده‌های قیمت/);
  assert.equal(kv.store.get(KV_KEYS.rebar), '{"fetchedAt":"old"}');
  assert.equal(kv.store.has(KV_KEYS.beam), false);
});

test("ingestAll rejects a structurally invalid dataset and leaves KV untouched", async (t) => {
  const payloads = await buildValidPayloads(t);
  payloads.rebar.categories[0].summary.min = -1; // structurally invalid
  const kv = fakeKv({
    [KV_KEYS.rebar]: '{"fetchedAt":"old-rebar"}',
    [KV_KEYS.beam]: '{"fetchedAt":"old-beam"}',
    [KV_KEYS.product]: '{"fetchedAt":"old-product"}',
  });

  const status = await ingestAll(kv, payloads);

  assert.equal(status.ok, false);
  assert.equal(kv.store.get(KV_KEYS.rebar), '{"fetchedAt":"old-rebar"}');
  assert.equal(kv.store.get(KV_KEYS.beam), '{"fetchedAt":"old-beam"}');
  assert.equal(kv.store.get(KV_KEYS.product), '{"fetchedAt":"old-product"}');
});

test("ingestAll stores canonical snapshot and all legacy projections", async (t) => {
  const { buildCatalogSnapshot } = await import(
    "../../scripts/lib/build-price-payloads.mjs"
  );
  t.mock.method(globalThis, "fetch", async () =>
    new Response(fakeCatalogHtml(), { status: 200 }),
  );
  const { snapshot } = await buildCatalogSnapshot();
  const kv = fakeKv();

  const status = await ingestAll(kv, { snapshot });

  assert.equal(status.ok, true);
  assert.deepEqual(JSON.parse(kv.store.get(KV_KEYS.catalog)), snapshot);
  assert.ok(kv.store.has(KV_KEYS.rebar));
  assert.ok(kv.store.has(KV_KEYS.beam));
  assert.ok(kv.store.has(KV_KEYS.product));
  assert.equal(JSON.parse(kv.store.get(STATUS_KEY)).ok, true);
});

test("ingestAll rejects a non-object body", async () => {
  const kv = fakeKv();
  const status = await ingestAll(kv, "not an object");
  assert.equal(status.ok, false);
});

