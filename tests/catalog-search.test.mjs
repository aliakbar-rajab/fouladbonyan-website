import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogSearchGroups,
  evaluateCatalogSearch,
  priceSectionHeading,
} from "../app/catalog-search.ts";
const { productGroups } = await import("../app/category-meta.ts");

const mockRow = (id, title, size, factory) => ({
  id,
  title,
  size,
  standard: "A3",
  grade: "St37",
  branchLength: "12",
  form: "شاخه",
  approximateWeight: "20",
  delivery: "تهران",
  unit: "کیلوگرم",
  factory,
  price: 55_000,
  percent: 1.5,
  status: "up",
  updatedAt: 1_700_000_000,
  updatedDate: "۱۴۰۲/۰۸/۲۳",
  specifications: [{ label: "ضخامت", value: "2mm" }],
});

const mockCategory = (id, label, rows) => ({
  id,
  label,
  groupingLabel: "کارخانه",
  specificationLabel: "استاندارد",
  sourceTitle: label,
  sourceUrl: "https://example.test/source",
  summary: {
    date: "امروز",
    min: 50_000,
    max: 60_000,
    average: 55_000,
    percent: 1.5,
    status: "up",
  },
  filters: {
    sizes: [...new Set(rows.map((r) => r.size))],
    factories: [...new Set(rows.map((r) => r.factory))],
  },
  factories: [...new Set(rows.map((r) => r.factory))].map((factoryName) => ({
    name: factoryName,
    updatedAt: 1_700_000_000,
    updatedDate: "۱۴۰۲/۰۸/۲۳",
    rows: rows.filter((r) => r.factory === factoryName),
  })),
});

const mockCatalogs = [
  {
    id: "rebar",
    label: "میلگرد",
    initialCategoryId: "ribbed",
    fetchedAt: "2026-07-27T10:00:00.000Z",
    sourceName: "منبع آزمایشی",
    sourceHome: "https://example.test/",
    taxRate: 0.1,
    categories: [
      mockCategory("ribbed", "میلگرد آجدار", [
        mockRow(1, "میلگرد آجدار ۱۴ نیشابور", "14", "نیشابور", "ribbed"),
        mockRow(2, "میلگرد آجدار ۱۶ اصفهان", "16", "ذوب‌آهن اصفهان", "ribbed"),
      ]),
      mockCategory("simple", "میلگرد ساده", [
        mockRow(3, "میلگرد ساده ۱۰ کویر کاشان", "10", "کویر کاشان", "simple"),
      ]),
    ],
  },
  {
    id: "beam",
    label: "تیرآهن",
    initialCategoryId: "beam",
    fetchedAt: "2026-07-27T10:00:00.000Z",
    sourceName: "منبع آزمایشی",
    sourceHome: "https://example.test/",
    taxRate: 0.1,
    categories: [
      mockCategory("beam", "تیرآهن IPE", [
        mockRow(4, "تیرآهن ۱۸ فایکو", "18", "فایکو", "beam"),
      ]),
    ],
  },
];

// ---------------------------------------------------------------------------
// 1. PURE INDEXING & EVALUATION TESTS
// ---------------------------------------------------------------------------

test("buildCatalogSearchGroups indexes all rows, category IDs, and search text accurately", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);

  const rebarGroup = searchGroups.find((g) => g.id === "rebar");
  assert.ok(rebarGroup);
  assert.equal(rebarGroup.rows.length, 3);

  const firstRow = rebarGroup.rows[0];
  assert.equal(firstRow.product, "میلگرد آجدار ۱۴ نیشابور");
  assert.equal(firstRow.size, "14");
  assert.equal(firstRow.factory, "نیشابور");
  assert.equal(firstRow.categoryId, "ribbed");
  assert.match(firstRow.searchText, /میلگرد آجدار/);
  assert.match(firstRow.searchText, /نیشابور/);
  assert.match(firstRow.searchText, /2mm/);
});

test("evaluateCatalogSearch matches Persian text and derives the first result's view parameters", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  const result = evaluateCatalogSearch("نیشابور", searchGroups);

  assert.equal(result.matchedGroups.length, 1);
  assert.equal(result.matchedGroups[0].id, "rebar");
  assert.equal(result.selectedGroupId, "rebar");
  assert.deepEqual(result.suggestedViewRequest, {
    categoryId: "ribbed",
    factory: "نیشابور",
    size: "14",
  });
  assert.match(result.statusMessage, /۱ نتیجه برای «نیشابور» پیدا شد/);
});

test("evaluateCatalogSearch normalizes Arabic Yeh/Kaf and Persian/Arabic digits", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  // Using Arabic Kaf (ك) and Arabic Yeh (ي) and ASCII digits:
  const result = evaluateCatalogSearch("كاشان 10", searchGroups);

  assert.equal(result.matchedGroups.length, 1);
  assert.equal(result.matchedGroups[0].id, "rebar");
  assert.equal(result.matchedGroups[0].rows[0].factory, "کویر کاشان");
  assert.equal(result.suggestedViewRequest.categoryId, "simple");
});

test("evaluateCatalogSearch handles queries with no matching products cleanly", () => {
  const searchGroups = buildCatalogSearchGroups(productGroups, mockCatalogs);
  const result = evaluateCatalogSearch("محصول_ناموجود_xyz", searchGroups);

  assert.equal(result.matchedGroups.length, 0);
  assert.match(result.statusMessage, /نتیجه‌ای برای «محصول_ناموجود_xyz» پیدا نشد/);
});

test("priceSectionHeading formats headings for category, subcategory, and home routes", () => {
  const subcatHeading = priceSectionHeading("میلگرد ساده", "میلگرد");
  assert.equal(subcatHeading.title, "جدول قیمت و مشخصات فنی میلگرد ساده");

  const catHeading = priceSectionHeading(undefined, "تیرآهن");
  assert.equal(catHeading.title, "جدول و مقایسه قیمت انواع تیرآهن");

  const defaultHeading = priceSectionHeading(undefined, undefined);
  assert.equal(defaultHeading.title, "قیمت روز آهن‌آلات و مقاطع فولادی");
});
