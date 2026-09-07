import assert from "node:assert/strict";
import test from "node:test";

import {
  PRICE_PENDING_TEXT,
  PRICE_UNAVAILABLE_TEXT,
  localizeCatalogValue,
  presentPrice,
  presentPriceRange,
  unixSecondsToIso,
} from "../app/catalog-presentation.ts";

/*
 * These assertions are the reason the module exists. Until the rule had an
 * interface, "this row has no price" was four separate one-token tests spread
 * across the price cell, the summary banner and two overview shells, and no
 * test could reach any of them without rendering React.
 */

test("a priced row shows its amount, its currency and its Sales unit", () => {
  const price = presentPrice(60_000, { unit: "کیلوگرم" });
  assert.equal(price.available, true);
  assert.equal(price.text, "۶۰٬۰۰۰");
  assert.equal(price.suffix, "تومان / کیلوگرم");
});

test("a priced row with no unit given still shows its currency", () => {
  assert.equal(presentPrice(60_000).suffix, "تومان");
});

test("Price unavailable reads as the sentinel and shows no price unit", () => {
  for (const missing of [null, undefined, 0]) {
    const price = presentPrice(missing, { unit: "کیلوگرم" });
    assert.equal(price.available, false, `${missing} must not count as priced`);
    assert.equal(price.text, PRICE_UNAVAILABLE_TEXT);
    assert.equal(
      price.suffix,
      null,
      "CONTEXT.md: an unavailable row does not show a price unit",
    );
  }
});

test("a negative or non-finite price is not a price", () => {
  assert.equal(presentPrice(-1).available, false);
  assert.equal(presentPrice(Number.NaN).available, false);
  assert.equal(presentPrice(Number.POSITIVE_INFINITY).available, false);
});

test("VAT is folded in only when the reader asked for it", () => {
  assert.equal(presentPrice(30_000, { taxRate: 0.1 }).text, "۳۰٬۰۰۰");
  assert.equal(
    presentPrice(30_000, { taxIncluded: true, taxRate: 0.1 }).text,
    "۳۳٬۰۰۰",
  );
});

test("VAT rounds to the nearest hundred toman", () => {
  // 30_001 * 1.1 = 33_001.1, which the table shows as 33,000.
  assert.equal(
    presentPrice(30_001, { taxIncluded: true, taxRate: 0.1 }).text,
    "۳۳٬۰۰۰",
  );
});

test("a range reads as its two ends, with one currency and unit", () => {
  const price = presentPriceRange(
    { min: 60_000, max: 83_200 },
    { unit: "کیلوگرم" },
  );
  assert.equal(price.available, true);
  assert.equal(price.text, "۶۰٬۰۰۰ تا ۸۳٬۲۰۰");
  assert.equal(price.suffix, "تومان / کیلوگرم");
});

test("a range with no summary to advertise is Price unavailable", () => {
  const price = presentPriceRange(null, { unit: "کیلوگرم" });
  assert.equal(price.available, false);
  assert.equal(price.text, PRICE_UNAVAILABLE_TEXT);
  assert.equal(price.suffix, null);
});

/*
 * The literal-zero summary of an all-unpriced category (catalog-pricing.mjs,
 * and an Open question in CONTEXT.md) must not reach the page as a price.
 */
test("the zero summary of an unpriced category is not a range", () => {
  assert.equal(presentPriceRange({ min: 0, max: 0 }).available, false);
});

test("a range applies VAT to both ends", () => {
  assert.equal(
    presentPriceRange(
      { min: 30_000, max: 30_000 },
      { taxIncluded: true, taxRate: 0.1 },
    ).text,
    "۳۳٬۰۰۰ تا ۳۳٬۰۰۰",
  );
});

test("pending and unavailable are different states", () => {
  assert.notEqual(PRICE_PENDING_TEXT, PRICE_UNAVAILABLE_TEXT);
});

test("dimensions are localized without digit grouping", () => {
  assert.equal(localizeCatalogValue("1250"), "۱۲۵۰");
  assert.equal(localizeCatalogValue("16"), "۱۶");
  assert.equal(localizeCatalogValue(""), "—");
  assert.equal(localizeCatalogValue(null), "—");
});

test("an undated row gets no machine-readable date", () => {
  assert.equal(unixSecondsToIso(0), undefined);
  assert.equal(unixSecondsToIso(Number.NaN), undefined);
  assert.equal(
    unixSecondsToIso(1_700_000_000),
    new Date(1_700_000_000_000).toISOString(),
  );
});
