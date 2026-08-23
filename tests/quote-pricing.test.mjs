import assert from "node:assert/strict";
import test from "node:test";
import { priceQuoteItem } from "../app/quote-pricing.ts";
import { buildGeneratedQuote } from "../app/quote-output.ts";

/*
 * Regression coverage for the branch-weight (شاخه) pricing path: a fractional
 * quantity used to be truncated by priceQuoteItem when computing the total
 * but read back whole by buildGeneratedQuote when deriving the printed unit
 * price, so the two disagreed. The form now rejects a non-integer شاخه/عدد
 * quantity before it reaches either function (see QuoteRequestForm.tsx's
 * validateQuantity); these tests pin the invariant that actually matters --
 * for any quantity the form will let through, unit price x quantity must
 * reconcile with the printed total.
 */

const contact = {
  fullName: "کاربر آزمایشی",
  phone: "09121234567",
  destination: "تهران",
  notes: "",
};

const rebarEstimate = {
  product: "میلگرد",
  unitPriceTomanPerKg: 60_000,
  minPriceTomanPerKg: 60_000,
  maxPriceTomanPerKg: 60_000,
  rowCount: 1,
  date: "امروز",
  branchWeight: "rebar-12m",
  supportsPieceUnits: true,
};

const beamEstimate = {
  product: "تیرآهن",
  unitPriceTomanPerKg: 70_000,
  minPriceTomanPerKg: 70_000,
  maxPriceTomanPerKg: 70_000,
  rowCount: 1,
  date: "امروز",
  supportsPieceUnits: true,
  pieceOptions: [
    { key: "beam:14", label: "تیرآهن — ۱۴", unit: "شاخه", priceToman: 5_500_000 },
  ],
};

function buildOneItemQuote(item, estimate) {
  const approximateTotal = priceQuoteItem(item, estimate);
  const priced = {
    item,
    estimate,
    pieceOption: item.pieceOptionKey
      ? estimate.pieceOptions?.find((option) => option.key === item.pieceOptionKey)
      : undefined,
    approximateTotal,
    effectiveUnit: item.pieceOptionKey
      ? (estimate.pieceOptions?.find((option) => option.key === item.pieceOptionKey)
          ?.unit ?? item.unit)
      : item.unit,
  };
  return { approximateTotal, quote: buildGeneratedQuote(contact, [priced]) };
}

test("a whole-number شاخه quantity priced by branch weight reconciles unit price x quantity with the total", () => {
  const item = {
    id: 1,
    product: "میلگرد",
    quantity: "3",
    unit: "شاخه",
    dimensions: "",
    rebarDiameterMm: "16",
    pieceOptionKey: "",
  };

  const { approximateTotal, quote } = buildOneItemQuote(item, rebarEstimate);
  assert.notEqual(approximateTotal, null);

  const [line] = quote.items;
  assert.notEqual(line.unitPriceRial, null);
  assert.notEqual(line.totalRial, null);
  // Rounding to the nearest rial can drift by at most one unit per multiply;
  // the bug this guards against drifted by a full quantity's worth of price.
  assert.ok(
    Math.abs(line.unitPriceRial * 3 - line.totalRial) <= 1,
    `unit price (${line.unitPriceRial}) x 3 should reconcile with total (${line.totalRial})`,
  );
});

test("a whole-number شاخه quantity priced from a real catalog piece option reconciles unit price x quantity with the total", () => {
  const item = {
    id: 1,
    product: "تیرآهن",
    quantity: "4",
    unit: "شاخه",
    dimensions: "",
    rebarDiameterMm: "",
    pieceOptionKey: "beam:14",
  };

  const { approximateTotal, quote } = buildOneItemQuote(item, beamEstimate);
  assert.notEqual(approximateTotal, null);

  const [line] = quote.items;
  assert.ok(
    Math.abs(line.unitPriceRial * 4 - line.totalRial) <= 1,
    `unit price (${line.unitPriceRial}) x 4 should reconcile with total (${line.totalRial})`,
  );
});
