import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCatalogPage,
  fetchCategory,
  fetchCategories,
  fetchCategoriesWithDiagnostics,
} from "../scripts/lib/catalog-source.mjs";
import { buildCatalogSnapshot } from "../scripts/lib/build-price-payloads.mjs";
import { validateCatalogSnapshot } from "../app/catalog-validation.mjs";



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
  const products = Array.from({ length }, (_, index) => fakeProductItem(index, title));
  const shopData = {
    title,
    products: [{ title: "کارخانه تست", productsitem: products }],
    price_compare: { date: "1404/01/01", percent: 1, status: "same" },
  };
  const nextData = { props: { pageProps: { shopData } } };
  return `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(nextData)}</script></body></html>`;
}

function fakeCatalogHtmlReversedAttributes({ length = 120, title = "تست" } = {}) {
  const products = Array.from({ length }, (_, index) => fakeProductItem(index, title));
  const shopData = {
    title,
    products: [{ title: "کارخانه تست", productsitem: products }],
    price_compare: { date: "1404/01/01", percent: 1, status: "same" },
  };
  const nextData = { props: { pageProps: { shopData } } };
  return `<html><body><script type="application/json" id="__NEXT_DATA__">${JSON.stringify(nextData)}</script></body></html>`;
}

test("parseCatalogPage extracts Next.js data with standard or reversed script attributes", () => {
  const source = { id: "test", label: "تست", url: "https://example.com" };
  const parsed1 = parseCatalogPage(fakeCatalogHtml(), source);
  const parsed2 = parseCatalogPage(fakeCatalogHtmlReversedAttributes(), source);

  assert.equal(parsed1.id, "test");
  assert.equal(parsed2.id, "test");
  assert.equal(parsed1.factories[0].rows.length, 120);
  assert.equal(parsed2.factories[0].rows.length, 120);
});

test("parseCatalogPage throws on missing __NEXT_DATA__ or corrupted JSON", () => {
  const source = { id: "test", label: "تست", url: "https://example.com" };
  assert.throws(
    () => parseCatalogPage("<html><body>بدون داده</body></html>", source),
    /پیدا نشد/,
  );
  assert.throws(
    () =>
      parseCatalogPage(
        '<html><body><script id="__NEXT_DATA__">{invalid json</script></body></html>',
        source,
      ),
    /تجزیه JSON/,
  );
});

test("fetchCategory retries on transient 500/503 errors with exponential backoff and succeeds", async () => {
  let callCount = 0;
  const retriesRecorded = [];
  const fakeFetch = async () => {
    callCount += 1;
    if (callCount < 3) {
      return new Response("Service Unavailable", { status: 503 });
    }
    return new Response(fakeCatalogHtml(), { status: 200 });
  };

  const source = { id: "test-src", label: "دسته تستی", url: "https://example.com/test" };
  const result = await fetchCategory(source, {
    attempts: 4,
    baseDelayMs: 10,
    maxDelayMs: 50,
    fetchImpl: fakeFetch,
    onRetry: (info) => retriesRecorded.push(info),
  });

  assert.equal(callCount, 3);
  assert.equal(retriesRecorded.length, 2);
  assert.equal(result.id, "test-src");
  assert.equal(result.factories[0].rows.length, 120);
});

test("fetchCategory respects retry-after header on 429 Too Many Requests", async () => {
  let callCount = 0;
  const fakeFetch = async () => {
    callCount += 1;
    if (callCount === 1) {
      return new Response("Rate limit", {
        status: 429,
        headers: { "retry-after": "1" },
      });
    }
    return new Response(fakeCatalogHtml(), { status: 200 });
  };

  const source = { id: "rate-limited", label: "تست محدودیت", url: "https://example.com" };
  const result = await fetchCategory(source, {
    attempts: 2,
    baseDelayMs: 10,
    maxDelayMs: 2000,
    fetchImpl: fakeFetch,
  });

  assert.equal(callCount, 2);
  assert.equal(result.id, "rate-limited");
});

test("fetchCategories isolates single source failures and uses fallback data", async () => {
  const sources = [
    { id: "src-1", label: "دسته اول", url: "https://example.com/1" },
    { id: "src-2", label: "دسته دوم", url: "https://example.com/2" },
    { id: "src-3", label: "دسته سوم", url: "https://example.com/3" },
  ];

  // Pre-existing valid fallback category for src-2
  const fallbackForSrc2 = {
    id: "src-2",
    label: "دسته دوم",
    groupingLabel: "کارخانه",
    specificationLabel: "استاندارد",
    sourceTitle: "دسته دوم قدیمی",
    sourceUrl: "https://example.com/2",
    summary: { min: 1000, max: 2000, average: 1500, percent: 0, status: "same", date: "1404/01/01" },
    filters: { sizes: ["12"], factories: ["کارخانه قدیمی"] },
    factories: [
      {
        name: "کارخانه قدیمی",
        updatedAt: 1700000000,
        updatedDate: "1404/01/01",
        rows: [
          {
            id: 999,
            title: "محصول قدیمی",
            size: "12",
            unit: "کیلوگرم",
            factory: "کارخانه قدیمی",
            price: 1500,
            percent: 0,
            status: "same",
            updatedAt: 1700000000,
          },
        ],
      },
    ],
  };

  const fakeFetch = async (url) => {
    if (url.includes("/2")) {
      return new Response("Internal Server Error", { status: 500 });
    }
    return new Response(fakeCatalogHtml({ length: 50 }), { status: 200 });
  };

  const warnings = [];
  const { categories, diagnostics } = await fetchCategoriesWithDiagnostics(sources, {
    limit: 2,
    attempts: 2,
    fallbackCategories: [fallbackForSrc2],
    fetchImpl: fakeFetch,
    onWarning: (msg) => warnings.push(msg),
  });

  assert.equal(categories.length, 3);
  assert.equal(categories[0].id, "src-1");
  assert.equal(categories[1].id, "src-2");
  assert.equal(categories[1].sourceTitle, "دسته دوم قدیمی"); // Used fallback!
  assert.equal(categories[2].id, "src-3");

  assert.equal(diagnostics.total, 3);
  assert.equal(diagnostics.freshCount, 2);
  assert.equal(diagnostics.fallbackCount, 1);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /ایزوله‌سازی خطا.*دسته دوم/);
});

test("fetchCategories throws when a category fails and has no fallback", async () => {
  const sources = [
    { id: "src-1", label: "دسته اول", url: "https://example.com/1" },
  ];
  const fakeFetch = async () => new Response("Not Found", { status: 404 });

  await assert.rejects(
    () =>
      fetchCategories(sources, {
        attempts: 1,
        fallbackCategories: [],
        fetchImpl: fakeFetch,
      }),
    /HTTP 404/,
  );
});



test("buildCatalogSnapshot completes and validates even when some categories use fallback", async () => {
  const fakeAllOkFetch = async () =>
    new Response(fakeCatalogHtml({ length: 120 }), { status: 200 });

  const { snapshot: baseline } = await buildCatalogSnapshot({
    fetchImpl: fakeAllOkFetch,
  });
  assert.ok(baseline.catalogs.length >= 8);

  const fakePartialFailFetch = async (url) => {
    const decoded = decodeURIComponent(url);
    if (decoded.includes("میلگرد-ساده") || decoded.includes("ورق-ck45")) {
      return new Response("Upstream Crash", { status: 502 });
    }
    return new Response(fakeCatalogHtml({ length: 120 }), { status: 200 });
  };

  const { snapshot: result, diagnostics } = await buildCatalogSnapshot({
    fallbackSnapshot: baseline,
    attempts: 2,
    fetchImpl: fakePartialFailFetch,
  });

  validateCatalogSnapshot(result);

  assert.equal(diagnostics.fallbackCategories, 2);
  assert.ok(diagnostics.freshCategories > 40);
  assert.equal(diagnostics.warnings.length, 2);
});


