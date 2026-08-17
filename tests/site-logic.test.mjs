import assert from "node:assert/strict";
import test from "node:test";
import {
  filterProductGroups,
  normalizeSearchText,
  toAsciiDigits,
} from "../app/site-logic.mjs";
import { localizeCatalogValue, toPersianDigits } from "../app/catalog-utils.ts";

// Shaped like the rows buildCatalogSearchGroups actually produces: ASCII digits
// in the title, plus the categoryId/factory/size/searchText navigation metadata.
// The previous fixture wrote the size as Persian "۱۶" inside the product name,
// which no live row does, so the digit test below passed against data the site
// never sees.
const groups = [
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

test("Persian and Arabic digits normalize to ASCII", () => {
  assert.equal(toAsciiDigits("۱۲۳٤٥"), "12345");
});

test("Arabic Yeh and Kaf normalize for Persian search", () => {
  assert.equal(normalizeSearchText("  ميلگرد كلاف  "), "میلگرد کلاف");
});

test("search finds a row by Persian product text", () => {
  const result = filterProductGroups(groups, "سیاه");
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
  const result = filterProductGroups(groups, "میلگرد ۱۶");
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "rebar");
  assert.equal(result[0].rows[0].size, "16");
});

test("empty search retains all groups", () => {
  assert.equal(filterProductGroups(groups, "  ").length, 2);
});

test("F5: dimensions convert to Persian digits without a thousands separator", () => {
  // localizeCatalogValue formats sizes/lengths/weights, never money, so a
  // 1250mm length must read as ۱۲۵۰, not ۱٬۲۵۰ (which looks like "1,250" and
  // implies a completely different magnitude).
  assert.equal(localizeCatalogValue("طول*1250"), "طول*۱۲۵۰");
  assert.equal(localizeCatalogValue("1000 گرم"), "۱۰۰۰ گرم");
  assert.equal(localizeCatalogValue("A3"), "A۳");
});

test("ASCII and Arabic digits convert to Persian digits", () => {
  assert.equal(toPersianDigits("0123456789"), "۰۱۲۳۴۵۶۷۸۹");
  assert.equal(toPersianDigits("٠١٢٣٤٥٦٧٨٩"), "۰۱۲۳۴۵۶۷۸۹");
  assert.equal(toPersianDigits("021-88888280"), "۰۲۱-۸۸۸۸۸۲۸۰");
  assert.equal(toPersianDigits("امروز دوشنبه 26 مرداد"), "امروز دوشنبه ۲۶ مرداد");
  assert.equal(toPersianDigits(null), "");
  assert.equal(toPersianDigits(undefined), "");
});

