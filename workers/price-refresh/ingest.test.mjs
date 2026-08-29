import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { ingestAll, KV_KEYS, STATUS_KEY } from "./ingest.mjs";

const committedSnapshot = JSON.parse(
  await readFile(
    new URL("../../app/data/catalog-prices.json", import.meta.url),
    "utf8",
  ),
);

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

function buildValidPayload() {
  const snapshot = structuredClone(committedSnapshot);
  const totalCategories = snapshot.catalogs.reduce(
    (total, catalog) => total + catalog.categories.length,
    0,
  );
  return {
    snapshot,
    diagnostics: {
      totalCategories,
      freshCategories: totalCategories,
      fallbackCategories: 0,
      warnings: [],
    },
  };
}

test("ingestAll stores the canonical catalog dataset and a success status for a valid payload", async () => {
  const { snapshot, diagnostics } = buildValidPayload();
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

test("ingestAll rejects a structurally invalid dataset and leaves KV untouched", async () => {
  const { snapshot, diagnostics } = buildValidPayload();
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
