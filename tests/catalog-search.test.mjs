import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalogSearchGroups,
  evaluateCatalogSearch,
  filterProductGroups,
  normalizeSearchText,
} from "../app/catalog-search.ts";
import { mockCatalogs } from "./helpers/catalog-search-fixture.mjs";
const { productGroups } = await import("../app/category-meta.ts");

// Shaped like the rows buildCatalogSearchGroups actually produces: ASCII digits
// in the title, plus the categoryId/factory/size/searchText navigation metadata.
const normalizationGroups = [
  {
    id: "rebar",
    label: "میلگرد",
    rows: [
      {
        product: "میلگرد 16 نیشابور آجدار A3",
        origin: "نیشابور",
        unit: "کیلوگرم",
        categoryId: "ribbed",
        factory: "نیشابور",
        size: "16",
        searchText: "میلگرد آجدار میلگرد 16 نیشابور آجدار A3 16 A3 نیشابور",
      },
    ],
  },
  {
    id: "sheet",
    label: "ورق فولادی",
    rows: [
      {
        product: "ورق سیاه فولاد مبارکه ضخامت 2 میل رول 1000",
        origin: "فولاد مبارکه",
        unit: "کیلوگرم",
        categoryId: "black-sheet",
        factory: "فولاد مبارکه",
        size: "1",
        searchText: "ورق سیاه ورق سیاه فولاد مبارکه ضخامت 2 میل رول 1000 st37",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// 1. NORMALIZATION & ROW FILTERING TESTS
// ---------------------------------------------------------------------------

test("Arabic Yeh and Kaf normalize for Persian search", () => {
  assert.equal(normalizeSearchText("  ميلگرد كلاف  "), "میلگرد کلاف");
});

test("search finds a row by Persian product text", () => {
  const result = filterProductGroups(normalizationGroups, "سیاه");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "sheet");
  assert.equal(
    result[0].rows[0].product,
    "ورق سیاه فولاد مبارکه ضخامت 2 میل رول 1000",
  );
});

test("search matches normalized Persian digits", () => {
  // Live rows store ASCII digits, so the normalization that matters is on the
  // query a Persian keyboard produces.
  const result = filterProductGroups(normalizationGroups, "میلگرد ۱۶");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "rebar");
  assert.equal(result[0].rows[0].size, "16");
});

test("empty search retains all groups", () => {
  assert.equal(filterProductGroups(normalizationGroups, "  ").length, 2);
});

// ---------------------------------------------------------------------------
// 2. PURE INDEXING & EVALUATION TESTS
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
