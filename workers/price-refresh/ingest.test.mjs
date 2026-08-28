import assert from "node:assert/strict";
import test from "node:test";
import { ingestAll, KV_KEYS, STATUS_KEY } from "./ingest.mjs";
import { buildCatalogSnapshot } from "../../scripts/lib/price-pipeline.mjs";

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

async function buildValidPayload(t) {
  t.mock.method(globalThis, "fetch", async () => new Response(fakeCatalogHtml(), { status: 200 }));
  return buildCatalogSnapshot();
}

test("ingestAll stores the canonical catalog dataset and a success status for a valid payload", async (t) => {
  const { snapshot, diagnostics } = await buildValidPayload(t);
  const kv = fakeKv();

  const status = await ingestAll(kv, { snapshot, diagnostics });

  assert.equal(status.ok, true);
  assert.deepEqual(JSON.parse(kv.store.get(KV_KEYS.catalog)), snapshot);
  assert.equal(JSON.parse(kv.store.get(STATUS_KEY)).ok, true);
});

test("ingestAll rejects a payload missing price data and leaves KV untouched", async () => {
  const kv = fakeKv({ [KV_KEYS.catalog]: '{"fetchedAt":"old"}' });

  const status = await ingestAll(kv, { invalid: true });

  assert.equal(status.ok, false);
  assert.match(status.error, /داده‌های قیمت/);
  assert.equal(kv.store.get(KV_KEYS.catalog), '{"fetchedAt":"old"}');
});

test("ingestAll rejects a structurally invalid dataset and leaves KV untouched", async (t) => {
  const { snapshot, diagnostics } = await buildValidPayload(t);
  snapshot.catalogs[0].categories[0].summary.min = -1; // structurally invalid
  const kv = fakeKv({
    [KV_KEYS.catalog]: '{"fetchedAt":"old-catalog"}',
  });

  const status = await ingestAll(kv, { snapshot, diagnostics });

  assert.equal(status.ok, false);
  assert.equal(kv.store.get(KV_KEYS.catalog), '{"fetchedAt":"old-catalog"}');
});

test("ingestAll rejects a non-object body", async () => {
  const kv = fakeKv();
  const status = await ingestAll(kv, "not an object");
  assert.equal(status.ok, false);
});

