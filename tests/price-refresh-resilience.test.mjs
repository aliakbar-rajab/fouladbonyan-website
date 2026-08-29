import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { updateLocalPriceSnapshot } from "../scripts/lib/price-pipeline.mjs";

function fakeProductItem(index, titlePrefix = "میلگرد") {
  return {
    id: index + 1,
    title: `${titlePrefix} ${index + 1}`,
    price: 100_000 + index * 100,
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

function fakeCatalogHtml({ length = 120, title = "تست" } = {}) {
  const products = Array.from({ length }, (_, index) =>
    fakeProductItem(index, title),
  );
  const shopData = {
    title,
    products: [{ title: "کارخانه تست", productsitem: products }],
    price_compare: { date: "1404/01/01", percent: 1, status: "same" },
  };
  const nextData = { props: { pageProps: { shopData } } };
  return `<html><body><script type="application/json" id="__NEXT_DATA__">${JSON.stringify(nextData)}</script></body></html>`;
}

async function withTempOutput(run) {
  const dir = await mkdtemp(join(tmpdir(), "price-workflow-"));
  const outputPath = join(dir, "catalog-prices.json");
  try {
    await run(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("price pipeline exposes only its three complete workflows", async () => {
  const pipeline = await import("../scripts/lib/price-pipeline.mjs");
  assert.deepEqual(Object.keys(pipeline).sort(), [
    "pullPriceSnapshot",
    "refreshAndPublishSnapshot",
    "updateLocalPriceSnapshot",
  ]);
});

test("local refresh hides parsing and transient retry behind one workflow", async () => {
  await withTempOutput(async (outputPath) => {
    let calls = 0;
    const warnings = [];
    const fetchImpl = async () => {
      calls += 1;
      if (calls < 3) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(fakeCatalogHtml(), { status: 200 });
    };

    const { snapshot, diagnostics } = await updateLocalPriceSnapshot({
      outputPath,
      fetchImpl,
      onWarning: (message) => warnings.push(message),
    });

    assert.ok(calls > snapshot.catalogs.length, "the transient source must retry");
    assert.equal(diagnostics.fallbackCategories, 0);
    assert.equal(warnings.length, 0);
    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), snapshot);
  });
});

test("local refresh preserves retry-after, malformed-source, and no-fallback failure behavior", async () => {
  await withTempOutput(async (outputPath) => {
    let targetUrl;
    const targetAttempts = [];
    const fetchImpl = async (url) => {
      targetUrl ??= url;
      if (url !== targetUrl) {
        return new Response(fakeCatalogHtml(), { status: 200 });
      }

      targetAttempts.push(Date.now());
      switch (targetAttempts.length) {
        case 1:
          return new Response("Rate limited", {
            status: 429,
            headers: { "retry-after": "1" },
          });
        case 2:
          return new Response("<html>بدون داده ساختاریافته</html>", {
            status: 200,
          });
        case 3:
          return new Response(
            '<script id="__NEXT_DATA__">{invalid json</script>',
            { status: 200 },
          );
        default:
          return new Response("Not Found", { status: 404 });
      }
    };

    await assert.rejects(
      updateLocalPriceSnapshot({ outputPath, fetchImpl }),
      /HTTP 404/,
    );
    assert.equal(targetAttempts.length, 4);
    assert.ok(
      targetAttempts[1] - targetAttempts[0] >= 900,
      "retry-after: 1 must delay the next attempt by about one second",
    );
    await assert.rejects(readFile(outputPath, "utf8"), /ENOENT/);
  });
});

test("local refresh keeps the prior valid category when one source fails", async () => {
  await withTempOutput(async (outputPath) => {
    const allOkFetch = async () =>
      new Response(fakeCatalogHtml(), { status: 200 });
    const { snapshot: initial } = await updateLocalPriceSnapshot({
      outputPath,
      fetchImpl: allOkFetch,
    });
    assert.ok(initial.catalogs.length >= 8);

    const partialFailureFetch = async (url) => {
      const decoded = decodeURIComponent(url);
      if (decoded.includes("میلگرد-ساده")) {
        return new Response("Upstream 503", { status: 503 });
      }
      return new Response(fakeCatalogHtml(), { status: 200 });
    };

    const warnings = [];
    const { snapshot, diagnostics } = await updateLocalPriceSnapshot({
      outputPath,
      fetchImpl: partialFailureFetch,
      onWarning: (message) => warnings.push(message),
    });

    assert.equal(diagnostics.fallbackCategories, 1);
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ایزوله‌سازی خطا.*میلگرد ساده/);
    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), snapshot);
  });
});
