import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parsePersianNumber,
  rialToWords,
} from "../app/persian-numbers.mjs";
import {
  formatToman,
} from "../app/quote/calculation.ts";
import { createQuoteEvaluator } from "../app/quote/evaluator.ts";
import { extractQuotePricingBaselines } from "../app/quote/pricing-source.ts";
import {
  buildQuoteDocument,
  buildQuoteMessage,
} from "../app/quote/serialization.ts";
import {
  validateQuoteField,
  validateQuoteRequestInput,
} from "../app/quote/validation.ts";
import {
  isQuoteProduct,
  isQuoteUnit,
  quoteDisclaimer,
  quoteProductNames,
  quoteUnits,
} from "../app/quote-types.ts";
import { loadAllGroupCatalogs } from "../app/catalog-reader.ts";
import { createQuoteRequestEstimate } from "../app/quote-request-estimate.ts";

const contact = {
  fullName: "کاربر آزمایشی",
  phone: "09121234567",
  destination: "تهران",
  notes: "",
};

test("React consumes the quote estimate flow without coordinating evaluator internals", async () => {
  const source = await readFile(
    new URL("../app/QuoteRequestForm.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /estimate\.estimateItems\(items\)/);
  assert.match(source, /evaluator\.evaluateRequest\(/);
  assert.match(source, /validateQuoteField\(/);
  assert.doesNotMatch(source, /createQuoteEvaluator|loadQuoteEvaluator|QuoteEvaluator/);
  assert.doesNotMatch(source, /supportsPieceUnits|getPieceOptions/);
  assert.doesNotMatch(source, /approximateTotalToman\s*\/\s*priced\.weightInKg/);
});

const rebarEstimate = {
  product: "میلگرد",
  unitPriceTomanPerKg: 60_000,
  minPriceTomanPerKg: 60_000,
  maxPriceTomanPerKg: 60_000,
  rowCount: 1,
  date: "امروز",
  branchWeight: "rebar-12m",
  supportsPieceUnits: true,
  pieceOptions: [],
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

const pipeEstimate = {
  product: "لوله فولادی",
  unitPriceTomanPerKg: 45_000,
  minPriceTomanPerKg: 40_000,
  maxPriceTomanPerKg: 50_000,
  rowCount: 5,
  date: "امروز",
  supportsPieceUnits: false,
  pieceOptions: [],
};

const allEstimates = {
  میلگرد: rebarEstimate,
  تیرآهن: beamEstimate,
  "لوله فولادی": pipeEstimate,
};

function buildOneItemQuote(item, estimate) {
  const evaluator = createQuoteEvaluator(
    estimate ? { [estimate.product]: estimate } : {},
  );
  const result = evaluator.evaluateRequest({
    contact,
    items: [item],
    acceptDisclaimer: true,
  });
  return {
    approximateTotal: result.items[0].approximateTotalToman,
    quote: result.document,
  };
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

test("catalog snapshot to quote evaluator extracts accurate baseline prices and piece options", () => {
  const mockSnapshot = {
    fetchedAt: "2026-08-29T00:00:00.000Z",
    sourceName: "فولاد ایرانیان",
    sourceHome: "https://www.fooladiranian.com/",
    taxRate: 0.1,
    catalogs: [
      {
        id: "rebar",
        label: "میلگرد",
        initialCategoryId: "ribbed",
        fetchedAt: "2026-08-29T00:00:00.000Z",
        sourceName: "فولاد ایرانیان",
        sourceHome: "https://www.fooladiranian.com/",
        taxRate: 0.1,
        categories: [
          {
            id: "ribbed",
            label: "میلگرد آجدار",
            groupingLabel: "کارخانه",
            specificationLabel: "سایز",
            sourceTitle: "قیمت میلگرد آجدار",
            sourceUrl: "https://example.com",
            summary: {
              date: "۱۴۰۵/۰۶/۰۷",
              min: 30000,
              max: 32000,
              average: 31000,
              percent: 0,
              status: "same",
            },
            filters: { sizes: ["14", "16"], factories: ["کارخانه نمونه"] },
            factories: [
              {
                name: "کارخانه نمونه",
                updatedAt: 0,
                updatedDate: "۱۴۰۵/۰۶/۰۷",
                rows: [
                  { id: 1, unit: "کیلوگرم", price: 30000, size: "14", title: "میلگرد ۱۴" },
                  { id: 2, unit: "کیلوگرم", price: 32000, size: "16", title: "میلگرد ۱۶" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "beam",
        label: "تیرآهن",
        initialCategoryId: "beam",
        fetchedAt: "2026-08-29T00:00:00.000Z",
        sourceName: "فولاد ایرانیان",
        sourceHome: "https://www.fooladiranian.com/",
        taxRate: 0.1,
        categories: [
          {
            id: "beam",
            label: "تیرآهن",
            groupingLabel: "کارخانه",
            specificationLabel: "سایز",
            sourceTitle: "قیمت تیرآهن",
            sourceUrl: "https://example.com",
            summary: {
              date: "۱۴۰۵/۰۶/۰۷",
              min: 40000,
              max: 42000,
              average: 41000,
              percent: 0,
              status: "same",
            },
            filters: { sizes: ["14"], factories: ["ذوب آهن"] },
            factories: [
              {
                name: "ذوب آهن",
                updatedAt: 0,
                updatedDate: "۱۴۰۵/۰۶/۰۷",
                rows: [
                  { id: 10, unit: "کیلوگرم", price: 40000, size: "14", title: "تیرآهن ۱۴ کیلو" },
                  { id: 11, unit: "شاخه", price: 6_000_000, size: "14", title: "تیرآهن ۱۴ شاخه سبک" },
                  { id: 12, unit: "شاخه", price: 8_000_000, size: "14", title: "تیرآهن ۱۴ شاخه سنگین" },
                ],
              },
            ],
          },
        ],
      },
    ],
  };

  const evaluator = createQuoteEvaluator(
    extractQuotePricingBaselines(mockSnapshot),
  );
  assert.equal(evaluator.supportsPieceUnits("میلگرد"), true);
  assert.equal(evaluator.requiresRebarDiameter("میلگرد"), true);
  assert.equal(evaluator.requiresRebarDiameter("تیرآهن"), false);

  const beamPieceOptions = evaluator.getPieceOptions("تیرآهن");
  assert.equal(beamPieceOptions.length, 2);
  assert.equal(beamPieceOptions[0].unit, "شاخه");
  assert.equal(beamPieceOptions[0].priceToman, 6_000_000);
  assert.equal(beamPieceOptions[1].priceToman, 8_000_000);
  assert.notEqual(
    beamPieceOptions[0].priceToman,
    7_000_000,
    "an exact option must never be a made-up average of distinct rows",
  );
  assert.match(beamPieceOptions[0].label, /سبک/);
  assert.match(beamPieceOptions[1].label, /سنگین/);

  // Evaluate rebar branch with diameter 14
  const rebarItem = evaluator.evaluateItem({
    id: 1,
    product: "میلگرد",
    quantity: "10",
    unit: "شاخه",
    rebarDiameterMm: "14",
  });
  assert.ok(rebarItem.approximateTotalToman !== null && rebarItem.approximateTotalToman > 0);
  assert.ok(rebarItem.weightInKg !== null && rebarItem.weightInKg > 0);

  // Evaluate beam piece option
  const beamItem = evaluator.evaluateItem({
    id: 2,
    product: "تیرآهن",
    quantity: "2",
    unit: "شاخه",
    pieceOptionKey: beamPieceOptions[0].key,
  });
  assert.equal(beamItem.approximateTotalToman, 12_000_000);
  assert.equal(beamItem.approximateTotalRial, 120_000_000);
});

test("missing or partial catalog prices handle unpriced products gracefully", () => {
  const evaluator = createQuoteEvaluator({}); // empty catalog
  const item = evaluator.evaluateItem({
    id: 1,
    product: "ورق فولادی",
    quantity: "5",
    unit: "تن",
  });

  assert.equal(item.approximateTotalToman, null);
  assert.equal(item.approximateTotalRial, null);
  assert.equal(item.unitPriceRial, null);
  assert.match(item.priceExplanation, /با واحد فروش تماس بگیرید/);

  const requestResult = evaluator.evaluateRequest({
    contact: { fullName: "تست", phone: "09121111111", destination: "تهران", notes: "" },
    items: [item],
    acceptDisclaimer: true,
  });

  assert.equal(requestResult.validation.isValid, true);
  assert.equal(requestResult.totals.hasAnyPriced, false);
  assert.equal(requestResult.totals.totalRial, 0);
  assert.match(requestResult.message, /محاسبه نشده/);
});

test("validateQuoteField requires no catalog data — required contact and disclaimer inputs", () => {
  // No evaluator, no baselines, no catalog load: validateQuoteField is a
  // direct pure export, independent of pricing data.
  assert.ok(validateQuoteField("fullName", "").length > 0);
  assert.ok(validateQuoteField("fullName", "ع").length > 0);
  assert.equal(validateQuoteField("fullName", "علی رضایی"), "");

  assert.ok(validateQuoteField("phone", "").length > 0);
  assert.ok(validateQuoteField("phone", "123").length > 0);
  assert.equal(validateQuoteField("phone", "09121234567"), "");
  assert.equal(validateQuoteField("phone", "۰۹۱۲۱۲۳۴۵۶۷"), "");
  assert.equal(validateQuoteField("phone", "+989121234567"), "");

  assert.ok(validateQuoteField("destination", "").length > 0);
  assert.equal(validateQuoteField("destination", "مشهد"), "");

  assert.ok(validateQuoteField("acceptDisclaimer", false).length > 0);
  assert.equal(validateQuoteField("acceptDisclaimer", true), "");
});

test("validateQuoteField requires no catalog data — item product and quantity with piece unit integer checks", () => {
  assert.equal(
    validateQuoteField("product", "", { itemIndex: 0 }),
    "نوع کالای ۱ را وارد کنید.",
  );
  assert.equal(
    validateQuoteField("product", "میلگرد", { itemIndex: 0 }),
    "",
  );

  assert.equal(
    validateQuoteField("quantity", "", { unit: "تن", itemIndex: 0 }),
    "مقدار تقریبی کالای ۱ را وارد کنید.",
  );
  assert.equal(
    validateQuoteField("quantity", "0", { unit: "تن", itemIndex: 0 }),
    "مقدار تقریبی کالای ۱ باید عددی بزرگ‌تر از صفر باشد.",
  );
  assert.equal(
    validateQuoteField("quantity", "-5", { unit: "تن", itemIndex: 0 }),
    "مقدار تقریبی کالای ۱ باید عددی بزرگ‌تر از صفر باشد.",
  );
  assert.equal(
    validateQuoteField("quantity", "۲.۵", { unit: "تن", itemIndex: 0 }),
    "",
  );
  assert.equal(
    validateQuoteField("quantity", "۲.۵", { unit: "شاخه", itemIndex: 0 }),
    "مقدار تقریبی کالای ۱ برای واحد شاخه باید عدد صحیح باشد.",
  );
  assert.equal(
    validateQuoteField("quantity", "۲.۵", { unit: "عدد", itemIndex: 0 }),
    "مقدار تقریبی کالای ۱ برای واحد عدد باید عدد صحیح باشد.",
  );
  assert.equal(
    validateQuoteField("quantity", "۱۰", { unit: "شاخه", itemIndex: 0 }),
    "",
  );
});

test("validateQuoteField and validateQuoteRequestInput are unaffected by missing or loading catalog prices — no evaluator constructed at all", () => {
  // Simulates the QuoteRequestForm state before loadQuoteEvaluator() resolves:
  // field validation must not depend on, wait for, or be gated by baselines.
  assert.equal(validateQuoteField("phone", "09121234567"), "");
  assert.ok(validateQuoteField("phone", "123").length > 0);

  const result = validateQuoteRequestInput({
    contact: { fullName: "کاربر آزمایشی", phone: "09121234567", destination: "تهران", notes: "" },
    items: [
      { id: 1, product: "میلگرد", quantity: "5", unit: "تن" },
    ],
    acceptDisclaimer: true,
  });
  assert.equal(result.isValid, true);
});

test("evaluator evaluates items and computes accurate Toman and Rial for weight, rebar and piece option items", () => {
  const evaluator = createQuoteEvaluator(allEstimates);

  // 1. Weight based (tonne -> 2 tonnes @ 45,000 toman/kg = 90,000,000 toman)
  const weightItem = evaluator.evaluateItem({
    id: 1,
    product: "لوله فولادی",
    quantity: "2",
    unit: "تن",
    dimensions: "",
    rebarDiameterMm: "",
    pieceOptionKey: "",
  });
  assert.equal(weightItem.weightInKg, 2000);
  assert.equal(weightItem.approximateTotalToman, 90_000_000);
  assert.equal(weightItem.approximateTotalRial, 900_000_000);
  assert.equal(weightItem.unitPriceRial, 450_000_000);

  // 2. Rebar branch weight (10 branches of rebar 16)
  const rebarItem = evaluator.evaluateItem({
    id: 2,
    product: "میلگرد",
    quantity: "۱۰",
    unit: "شاخه",
    dimensions: "A3",
    rebarDiameterMm: "۱۶",
    pieceOptionKey: "",
  });
  assert.ok(rebarItem.weightInKg !== null && rebarItem.weightInKg > 0);
  assert.ok(rebarItem.approximateTotalToman !== null && rebarItem.approximateTotalToman > 0);
  assert.equal(rebarItem.approximateTotalRial, rebarItem.approximateTotalToman * 10);

  // 3. Piece option item (5 branches of beam 14 @ 5,500,000 toman = 27,500,000 toman)
  const beamItem = evaluator.evaluateItem({
    id: 3,
    product: "تیرآهن",
    quantity: "5",
    unit: "شاخه",
    dimensions: "",
    rebarDiameterMm: "",
    pieceOptionKey: "beam:14",
  });
  assert.equal(beamItem.effectiveUnit, "شاخه");
  assert.equal(beamItem.approximateTotalToman, 27_500_000);
  assert.equal(beamItem.approximateTotalRial, 275_000_000);
  assert.equal(beamItem.unitPriceRial, 55_000_000);
});

test("evaluator evaluateItems aggregates multi-item totals and item counts", () => {
  const evaluator = createQuoteEvaluator(allEstimates);
  const items = [
    {
      id: 1,
      product: "لوله فولادی",
      quantity: "1",
      unit: "تن",
      dimensions: "",
      rebarDiameterMm: "",
      pieceOptionKey: "",
    },
    {
      id: 2,
      product: "سایر محصولات فولادی",
      quantity: "100",
      unit: "کیلوگرم",
      dimensions: "سفارشی",
      rebarDiameterMm: "",
      pieceOptionKey: "",
    },
  ];

  const pricing = evaluator.evaluateItems(items);
  assert.equal(pricing.totals.totalItemCount, 2);
  assert.equal(pricing.totals.pricedItemCount, 1);
  assert.equal(pricing.totals.hasAnyPriced, true);
  assert.equal(pricing.totals.totalToman, 45_000_000);
  assert.equal(pricing.totals.totalRial, 450_000_000);
});

test("quote request estimate exposes one presentation-ready flow to React", () => {
  const estimate = createQuoteRequestEstimate(
    createQuoteEvaluator(allEstimates),
  );
  assert.deepEqual(Object.keys(estimate).sort(), [
    "applyItemChange",
    "estimateItems",
  ]);

  const result = estimate.estimateItems([
    {
      id: 1,
      product: "تیرآهن",
      quantity: "2",
      unit: "شاخه",
      dimensions: "",
      rebarDiameterMm: "",
      pieceOptionKey: "beam:14",
    },
    {
      id: 2,
      product: "لوله فولادی",
      quantity: "1",
      unit: "تن",
      dimensions: "",
      rebarDiameterMm: "",
      pieceOptionKey: "",
    },
  ]);

  assert.equal(result.items[0].pieceOptions.length, 1);
  assert.deepEqual(result.items[0].availableUnits, quoteUnits);
  assert.equal(result.items[0].isPieceUnit, true);
  assert.deepEqual(result.items[1].availableUnits, quoteUnits);
  assert.equal(result.items[1].unitPriceTomanPerKg, 45_000);
  assert.equal(result.totals.pricedItemCount, 2);
  assert.equal(
    validateQuoteField("quantity", "۲.۵", {
      unit: "شاخه",
      itemIndex: 0,
    }),
    "مقدار تقریبی کالای ۱ برای واحد شاخه باید عدد صحیح باشد.",
  );
});

test("changing to a product that is not sold by the piece takes the piece unit with it", () => {
  const estimate = createQuoteRequestEstimate(
    createQuoteEvaluator(allEstimates),
  );
  const beamByBranch = {
    id: 1,
    product: "تیرآهن",
    quantity: "2.5",
    unit: "شاخه",
    dimensions: "",
    rebarDiameterMm: "",
    pieceOptionKey: "",
  };

  // ورق فولادی is priced by weight only. Left on شاخه, the item was still
  // priced and validated by the piece while its <select> -- which no longer
  // listed شاخه -- displayed تن, so a decimal quantity was refused for a unit
  // the form never showed and could not be selected back.
  const switched = estimate.applyItemChange(beamByBranch, {
    product: "ورق فولادی",
  });
  assert.equal(switched.unit, "تن");

  const [priced] = estimate.estimateItems([switched]).items;
  assert.ok(priced.availableUnits.includes(priced.unit));
  assert.equal(
    validateQuoteField("quantity", priced.quantity, { unit: priced.unit }),
    "",
  );

  // A piece unit survives a change between two products that both sell by it.
  assert.equal(
    estimate.applyItemChange(beamByBranch, { product: "میلگرد" }).unit,
    "شاخه",
  );
  // Edits that are not product changes never touch the unit.
  assert.equal(
    estimate.applyItemChange(beamByBranch, { quantity: "9" }).unit,
    "شاخه",
  );
});

test("product unit capability is stable before and after the asynchronous price load", () => {
  const emptyEstimate = createQuoteRequestEstimate(createQuoteEvaluator());
  const rawSheetByBranch = {
    id: 1,
    product: "ورق فولادی",
    quantity: "3",
    unit: "شاخه",
    dimensions: "",
    rebarDiameterMm: "",
    pieceOptionKey: "",
  };

  assert.deepEqual(
    emptyEstimate.estimateItems([rawSheetByBranch]).items[0].availableUnits,
    ["تن", "کیلوگرم"],
  );

  const narrowed = createQuoteRequestEstimate(
    createQuoteEvaluator(allEstimates),
  ).estimateItems([rawSheetByBranch]);

  assert.deepEqual(narrowed.items[0].availableUnits, ["تن", "کیلوگرم"]);

  const invalid = validateQuoteRequestInput({
    contact,
    items: [rawSheetByBranch],
    acceptDisclaimer: true,
  });
  assert.equal(invalid.isValid, false);
  assert.match(invalid.errors["itemQuantity-1"], /واحد شاخه/);
});

test("buildQuoteMessage creates a human-readable Persian quote summary with disclaimer", () => {
  const evaluator = createQuoteEvaluator(allEstimates);
  const evaluation = evaluator.evaluateItems([
    {
      id: 1,
      product: "تیرآهن",
      quantity: "2",
      unit: "شاخه",
      dimensions: "سایز ۱۴",
      rebarDiameterMm: "",
      pieceOptionKey: "beam:14",
    },
  ]);

  const message = buildQuoteMessage(contact, evaluation.items, evaluation.totals);
  assert.match(message, /درخواست پیش‌فاکتور غیرقطعی/);
  assert.match(message, /نام: کاربر آزمایشی/);
  assert.match(message, /شماره تماس: 09121234567/);
  assert.match(message, /تیرآهن/);
  assert.match(message, /جمع تقریبی:/);
  assert.match(message, /شهر مقصد: تهران/);
  assert.match(message, new RegExp(quoteDisclaimer));
});

test("evaluateRequest executes complete normalization, validation, pricing, message and document serialization", () => {
  const evaluator = createQuoteEvaluator(allEstimates);

  // Valid request
  const validResult = evaluator.evaluateRequest({
    contact: {
      fullName: "  محمد محمدی  ",
      phone: " ۰۹۱۲۳۴۵۶۷۸۹ ",
      destination: " تبریز ",
      notes: "ارسال با تریلی",
    },
    items: [
      {
        id: 1,
        product: "میلگرد",
        quantity: "۵",
        unit: "شاخه",
        dimensions: "A3",
        rebarDiameterMm: "۱۴",
        pieceOptionKey: "",
      },
    ],
    acceptDisclaimer: true,
  });

  assert.equal(validResult.validation.isValid, true);
  assert.equal(Object.keys(validResult.validation.errors).length, 0);
  assert.equal(validResult.input.contact.fullName, "محمد محمدی");
  assert.equal(validResult.input.contact.phone, "09123456789");
  assert.ok(validResult.totals.totalRial > 0);
  assert.equal(validResult.document.fullName, "محمد محمدی");
  assert.equal(validResult.document.items.length, 1);
  assert.match(validResult.message, /محمد محمدی/);

  // Invalid request
  const invalidResult = evaluator.evaluateRequest({
    contact: {
      fullName: "",
      phone: "123",
      destination: "",
      notes: "",
    },
    items: [
      {
        id: 1,
        product: "",
        quantity: "invalid",
        unit: "تن",
        dimensions: "",
        rebarDiameterMm: "",
        pieceOptionKey: "",
      },
    ],
    acceptDisclaimer: false,
  });

  assert.equal(invalidResult.validation.isValid, false);
  assert.ok(invalidResult.validation.errors.fullName);
  assert.ok(invalidResult.validation.errors.phone);
  assert.ok(invalidResult.validation.errors.destination);
  assert.ok(invalidResult.validation.errors.acceptDisclaimer);
  assert.ok(invalidResult.validation.errors["itemProduct-1"]);
  assert.ok(invalidResult.validation.errors["itemQuantity-1"]);
});

test("validateQuoteRequestInput checks full form structure correctly — no catalog data required", () => {
  const valid = validateQuoteRequestInput({
    contact: {
      fullName: "حسین حسینی",
      phone: "09121111111",
      destination: "شیراز",
      notes: "",
    },
    items: [
      {
        id: 1,
        product: "میلگرد",
        quantity: "10",
        unit: "شاخه",
        dimensions: "A3",
        rebarDiameterMm: "14",
        pieceOptionKey: "",
      },
    ],
    acceptDisclaimer: true,
  });

  assert.equal(valid.isValid, true);
  assert.equal(Object.keys(valid.errors).length, 0);
});

test("buildQuoteDocument generates complete printable document structure", () => {
  const evaluator = createQuoteEvaluator(allEstimates);
  const evaluation = evaluator.evaluateItems([
    {
      id: 1,
      product: "میلگرد",
      quantity: "2",
      unit: "تن",
      dimensions: "A3",
      rebarDiameterMm: "",
      pieceOptionKey: "",
    },
  ]);

  const doc = buildQuoteDocument(contact, evaluation.items, evaluation.totals);
  assert.equal(doc.fullName, "کاربر آزمایشی");
  assert.equal(doc.destination, "تهران");
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].product, "میلگرد");
  assert.equal(doc.items[0].unitPriceRial, 600_000_000);
  assert.equal(doc.totalRial, 1_200_000_000);
});

test("domain product and unit metadata arrays and type guards behave accurately", () => {
  assert.ok(quoteProductNames.includes("میلگرد"));
  assert.ok(quoteProductNames.includes("تیرآهن"));
  assert.ok(quoteUnits.includes("تن"));
  assert.ok(quoteUnits.includes("شاخه"));

  assert.equal(isQuoteProduct("میلگرد"), true);
  assert.equal(isQuoteProduct("ناشناخته"), false);
  assert.equal(isQuoteUnit("تن"), true);
  assert.equal(isQuoteUnit("متر"), false);
});

test("formatToman currency formatting helper displays Persian localized amounts", () => {
  assert.equal(formatToman(50_000), "۵۰٬۰۰۰ تومان");
  assert.equal(formatToman(1_250_000), "۱٬۲۵۰٬۰۰۰ تومان");
});

test("parsePersianNumber parses Persian/Arabic decimal and thousands separators", () => {
  assert.equal(parsePersianNumber("۲/۵"), 2.5);
  assert.equal(parsePersianNumber("۲٫۵"), 2.5);
  assert.equal(parsePersianNumber("12.5"), 12.5);
  assert.equal(parsePersianNumber("۱,۰۰۰"), 1000);
  assert.equal(parsePersianNumber("۱٬۲۵۰"), 1250);
  assert.equal(parsePersianNumber("  ۱۰ "), 10);
  assert.equal(parsePersianNumber("۰"), 0);
  assert.equal(parsePersianNumber(""), null);
  assert.equal(parsePersianNumber("نامعتبر"), null);
});

test("rialToWords handles zero, negative, and normal values safely", () => {
  assert.equal(rialToWords(0), "صفر ریال");
  assert.equal(rialToWords(-100), "صفر ریال");
  assert.equal(rialToWords(1_000_000), "یک میلیون ریال");
  assert.equal(rialToWords(10_000_000), "ده میلیون ریال");
});

test("quote evaluator evaluates against live catalog files", async () => {
  const evaluator = createQuoteEvaluator(
    extractQuotePricingBaselines(await loadAllGroupCatalogs()),
  );
  const rebarEvaluation = evaluator.evaluateItem({
    id: 1,
    product: "میلگرد",
    quantity: "1",
    unit: "تن",
  });
  assert.ok(rebarEvaluation.approximateTotalToman !== null && rebarEvaluation.approximateTotalToman > 0);
});
