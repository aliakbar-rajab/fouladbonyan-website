import assert from "node:assert/strict";
import test from "node:test";
import {
  publishPayloads,
  refreshAndPublishSnapshot,
} from "../scripts/lib/price-pipeline.mjs";

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
  const products = Array.from({ length: 120 }, (_, index) =>
    fakeProductItem(index),
  );
  const shopData = {
    title: "تست",
    products: [{ title: "کارخانه تست", productsitem: products }],
    price_compare: { date: "1404/01/01", percent: 1, status: "same" },
  };
  const nextData = { props: { pageProps: { shopData } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
}

test("publishPayloads posts the payload with a bearer token and returns the parsed body", async () => {
  let seenRequest;
  const fetchImpl = async (url, init) => {
    seenRequest = { url, init };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await publishPayloads({
    endpoint: "https://price.example",
    token: "secret-token",
    payloads: { snapshot: {}, diagnostics: {} },
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(seenRequest.url, "https://price.example/ingest");
  assert.equal(seenRequest.init.method, "POST");
  assert.equal(seenRequest.init.headers.authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(seenRequest.init.body), {
    snapshot: {},
    diagnostics: {},
  });
});

test("publishPayloads throws with the Worker's error message on a non-2xx response", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({ ok: false, error: "میلگرد آجدار: HTTP 503" }),
      { status: 422 },
    );

  await assert.rejects(
    () =>
      publishPayloads({
        endpoint: "https://price.example",
        token: "secret-token",
        payloads: { snapshot: {} },
        fetchImpl,
      }),
    /HTTP 422.*میلگرد آجدار/,
  );
});

test("publishPayloads throws when the response body isn't JSON", async () => {
  const fetchImpl = async () => new Response("upstream 502", { status: 502 });

  await assert.rejects(
    () =>
      publishPayloads({
        endpoint: "https://price.example",
        token: "secret-token",
        payloads: { snapshot: {} },
        fetchImpl,
      }),
    /HTTP 502/,
  );
});

test("refreshAndPublishSnapshot fetches live prices, validates snapshot, and publishes to Worker", async () => {
  let ingestCalled = false;
  const fetchImpl = async (url, init) => {
    if (url.includes("/ingest")) {
      ingestCalled = true;
      assert.equal(init.headers.authorization, "Bearer test-worker-token");
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    return new Response(fakeCatalogHtml(), { status: 200 });
  };

  const result = await refreshAndPublishSnapshot({
    endpoint: "https://price.example",
    token: "test-worker-token",
    fetchImpl,
  });

  assert.equal(ingestCalled, true);
  assert.equal(result.publishResult.ok, true);
  assert.ok(result.snapshot.catalogs.length >= 8);
  assert.ok(result.diagnostics.freshCategories > 40);
});
