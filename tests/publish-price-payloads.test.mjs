import assert from "node:assert/strict";
import test from "node:test";
import { refreshAndPublishSnapshot } from "../scripts/lib/price-pipeline.mjs";

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
  return `<script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { shopData } } })}</script>`;
}

const runRefresh = (ingestResponse) => {
  let seenRequest;
  const fetchImpl = async (url, init) => {
    if (url.endsWith("/ingest")) {
      seenRequest = { url, init };
      return ingestResponse();
    }
    return new Response(fakeCatalogHtml(), { status: 200 });
  };
  return {
    seenRequest: () => seenRequest,
    result: refreshAndPublishSnapshot({
      endpoint: "https://price.example",
      token: "test-worker-token",
      fetchImpl,
    }),
  };
};

test("refresh-and-publish hides source work and posts one validated payload", async () => {
  const run = runRefresh(
    () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  const result = await run.result;
  const request = run.seenRequest();

  assert.equal(result.publishResult.ok, true);
  assert.ok(result.snapshot.catalogs.length >= 8);
  assert.ok(result.diagnostics.freshCategories > 40);
  assert.equal(request.url, "https://price.example/ingest");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.authorization, "Bearer test-worker-token");
  const payload = JSON.parse(request.init.body);
  assert.deepEqual(payload.snapshot, result.snapshot);
  assert.deepEqual(payload.diagnostics, result.diagnostics);
});

test("refresh-and-publish reports the Worker's structured rejection", async () => {
  const run = runRefresh(
    () =>
      new Response(
        JSON.stringify({ ok: false, error: "میلگرد آجدار: HTTP 503" }),
        { status: 422 },
      ),
  );
  await assert.rejects(run.result, /HTTP 422.*میلگرد آجدار/);
});

test("refresh-and-publish reports a non-JSON Worker failure", async () => {
  const run = runRefresh(
    () => new Response("upstream 502", { status: 502 }),
  );
  await assert.rejects(run.result, /HTTP 502/);
});
