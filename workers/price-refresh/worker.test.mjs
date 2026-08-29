import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

const committedSnapshot = JSON.parse(
  await readFile(
    new URL("../../app/data/catalog-prices.json", import.meta.url),
    "utf8",
  ),
);

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

test("GET /catalog-snapshot.json serves the stored snapshot", async () => {
  const env = { PRICE_DATA: fakeKv({ [KV_KEYS.catalog]: '{"fetchedAt":"now","catalogs":[]}' }) };
  const response = await worker.fetch(new Request("https://price.example/catalog-snapshot.json"), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { fetchedAt: "now", catalogs: [] });
});

test("GET a dataset that has never been written returns 503", async () => {
  const env = { PRICE_DATA: fakeKv() };
  const response = await worker.fetch(new Request("https://price.example/catalog-prices.json"), env);
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
  const { snapshot, diagnostics } = buildValidPayload();
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
      body: JSON.stringify({ snapshot, diagnostics }),
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.ok(env.PRICE_DATA.store.has(KV_KEYS.catalog));
  assert.equal(calledUrls.includes("https://deploy.example/hook"), true);
});

test("POST /ingest accepts the exact { snapshot, diagnostics } shape refresh-and-publish.mjs sends", async () => {
  const { snapshot, diagnostics } = buildValidPayload();
  const producerPayload = { snapshot, diagnostics };

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
      body: JSON.stringify({ invalid: true }),
    }),
    env,
  );

  assert.equal(response.status, 422);
  assert.equal(env.PRICE_DATA.store.has(KV_KEYS.catalog), false);
  assert.equal(calledUrls.includes("https://deploy.example/hook"), false);
});
