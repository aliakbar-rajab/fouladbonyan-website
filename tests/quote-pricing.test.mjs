import assert from "node:assert/strict";
import test from "node:test";
import { deriveQuoteEstimates } from "../app/quote-pricing.ts";
import {
  buildQuoteMessage,
  deriveQuoteItemPricing,
  deriveQuotePricing,
  normalizePhone,
  normalizeQuoteContact,
  normalizeQuoteItem,
  normalizeQuoteRequest,
  parsePersianNumber,
  prepareQuoteRequest,
  resolvePieceOption,
  validateDestination,
  validateFullName,
  validatePhone,
  validateQuantity,
  validateQuoteRequest,
} from "../app/quote-engine.ts";

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

const pipeEstimate = {
  product: "لوله فولادی",
  unitPriceTomanPerKg: 45_000,
  minPriceTomanPerKg: 40_000,
  maxPriceTomanPerKg: 50_000,
  rowCount: 5,
  date: "امروز",
  supportsPieceUnits: false,
};

const allEstimates = {
  میلگرد: rebarEstimate,
  تیرآهن: beamEstimate,
  "لوله فولادی": pipeEstimate,
};

function buildOneItemQuote(item, estimate) {
  const result = prepareQuoteRequest(
    { contact, items: [item], acceptDisclaimer: true },
    estimate ? { [estimate.product]: estimate } : {},
  );
  return {
    approximateTotal: result.pricing.items[0].approximateTotalToman,
    quote: result.output.document,
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

test("normalizeQuoteContact trims whitespace and normalizes Iranian phone numbers", () => {
  const normalized = normalizeQuoteContact({
    fullName: "  علی اکبری  ",
    phone: " +98 912 345-6789 ",
    destination: " اصفهان ",
    notes: "  توضیحات فوری  ",
  });

  assert.equal(normalized.fullName, "علی اکبری");
  assert.equal(normalized.phone, "+989123456789");
  assert.equal(normalized.destination, "اصفهان");
  assert.equal(normalized.notes, "توضیحات فوری");
});

test("parsePersianNumber parses ASCII, Persian and Arabic digits correctly", () => {
  assert.equal(parsePersianNumber("12.5"), 12.5);
  assert.equal(parsePersianNumber("۱۲.۵"), 12.5);
  assert.equal(parsePersianNumber("١٢.٥"), 12.5);
  assert.equal(parsePersianNumber("نامعتبر"), null);
  assert.equal(parsePersianNumber(""), null);
});

test("normalizeQuoteItem parses Persian digits for quantity and diameter", () => {
  const normalized = normalizeQuoteItem({
    id: 3,
    product: "میلگرد",
    quantity: "۱۲",
    unit: "شاخه",
    dimensions: "  A3  ",
    rebarDiameterMm: "۱۶",
    pieceOptionKey: "",
  });

  assert.equal(normalized.quantityNumeric, 12);
  assert.equal(normalized.rebarDiameterNumeric, 16);
  assert.equal(normalized.dimensions, "A3");
  assert.equal(normalized.unit, "شاخه");
});

test("validateQuantity enforces positive numbers and integer piece constraints with Persian digits", () => {
  assert.equal(validateQuantity("", "تن", 0), "مقدار تقریبی کالای ۱ را وارد کنید.");
  assert.equal(validateQuantity("0", "تن", 0), "مقدار تقریبی کالای ۱ باید عددی بزرگ‌تر از صفر باشد.");
  assert.equal(validateQuantity("-5", "تن", 0), "مقدار تقریبی کالای ۱ باید عددی بزرگ‌تر از صفر باشد.");
  assert.equal(validateQuantity("۲.۵", "تن", 0), ""); // 2.5 tonnes is valid
  assert.equal(
    validateQuantity("۲.۵", "شاخه", 0),
    "مقدار تقریبی کالای ۱ برای واحد شاخه باید عدد صحیح باشد.",
  );
  assert.equal(
    validateQuantity("۲.۵", "عدد", 0),
    "مقدار تقریبی کالای ۱ برای واحد عدد باید عدد صحیح باشد.",
  );
  assert.equal(validateQuantity("۱۰", "شاخه", 0), "");
});

test("validateFullName, validatePhone, validateDestination validate required fields correctly", () => {
  assert.ok(validateFullName("").length > 0);
  assert.ok(validateFullName("ع").length > 0);
  assert.equal(validateFullName("علی رضایی"), "");

  assert.ok(validatePhone("").length > 0);
  assert.ok(validatePhone("123").length > 0);
  assert.equal(validatePhone("09121234567"), "");
  assert.equal(validatePhone("۰۹۱۲۱۲۳۴۵۶۷"), "");
  assert.equal(validatePhone("+989121234567"), "");

  assert.ok(validateDestination("").length > 0);
  assert.equal(validateDestination("مشهد"), "");
});

test("deriveQuoteItemPricing computes accurate Toman and Rial for weight, rebar and piece option items", () => {
  // 1. Weight based (tonne -> 2 tonnes @ 45,000 toman/kg = 90,000,000 toman)
  const weightItem = deriveQuoteItemPricing(
    {
      id: 1,
      product: "لوله فولادی",
      quantity: "2",
      unit: "تن",
      dimensions: "",
      rebarDiameterMm: "",
      pieceOptionKey: "",
    },
    allEstimates,
  );
  assert.equal(weightItem.weightInKg, 2000);
  assert.equal(weightItem.approximateTotalToman, 90_000_000);
  assert.equal(weightItem.approximateTotalRial, 900_000_000);
  assert.equal(weightItem.unitPriceRial, 450_000_000);

  // 2. Rebar branch weight (10 branches of rebar 16)
  const rebarItem = deriveQuoteItemPricing(
    {
      id: 2,
      product: "میلگرد",
      quantity: "۱۰",
      unit: "شاخه",
      dimensions: "A3",
      rebarDiameterMm: "۱۶",
      pieceOptionKey: "",
    },
    allEstimates,
  );
  assert.ok(rebarItem.weightInKg !== null && rebarItem.weightInKg > 0);
  assert.ok(rebarItem.approximateTotalToman !== null && rebarItem.approximateTotalToman > 0);
  assert.equal(rebarItem.approximateTotalRial, rebarItem.approximateTotalToman * 10);

  // 3. Piece option item (5 branches of beam 14 @ 5,500,000 toman = 27,500,000 toman)
  const beamItem = deriveQuoteItemPricing(
    {
      id: 3,
      product: "تیرآهن",
      quantity: "5",
      unit: "شاخه",
      dimensions: "",
      rebarDiameterMm: "",
      pieceOptionKey: "beam:14",
    },
    allEstimates,
  );
  assert.equal(beamItem.effectiveUnit, "شاخه");
  assert.equal(beamItem.approximateTotalToman, 27_500_000);
  assert.equal(beamItem.approximateTotalRial, 275_000_000);
  assert.equal(beamItem.unitPriceRial, 55_000_000);
});

test("deriveQuotePricing aggregates multi-item totals and counts", () => {
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
      product: "سایر محصولات فولادی", // Unpriced product
      quantity: "100",
      unit: "کیلوگرم",
      dimensions: "سفارشی",
      rebarDiameterMm: "",
      pieceOptionKey: "",
    },
  ];

  const pricing = deriveQuotePricing(items, allEstimates);
  assert.equal(pricing.totals.totalItemCount, 2);
  assert.equal(pricing.totals.pricedItemCount, 1);
  assert.equal(pricing.totals.hasAnyPriced, true);
  assert.equal(pricing.totals.totalToman, 45_000_000);
  assert.equal(pricing.totals.totalRial, 450_000_000);
});

test("buildQuoteMessage formats a clean, human-readable Persian quote summary", () => {
  const pricing = deriveQuotePricing(
    [
      {
        id: 1,
        product: "تیرآهن",
        quantity: "2",
        unit: "شاخه",
        dimensions: "سایز ۱۴",
        rebarDiameterMm: "",
        pieceOptionKey: "beam:14",
      },
    ],
    allEstimates,
  );

  const message = buildQuoteMessage(
    normalizeQuoteContact(contact),
    pricing.items,
    pricing.totals,
  );
  assert.match(message, /درخواست پیش‌فاکتور غیرقطعی/);
  assert.match(message, /نام: کاربر آزمایشی/);
  assert.match(message, /شماره تماس: 09121234567/);
  assert.match(message, /تیرآهن/);
  assert.match(message, /جمع تقریبی:/);
  assert.match(message, /شهر مقصد: تهران/);
});

test("prepareQuoteRequest executes complete normalization, validation, pricing and output serialization", () => {
  // Valid request
  const validResult = prepareQuoteRequest(
    {
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
    },
    allEstimates,
  );

  assert.equal(validResult.validation.isValid, true);
  assert.equal(Object.keys(validResult.validation.errors).length, 0);
  assert.equal(validResult.input.contact.fullName, "محمد محمدی");
  assert.equal(validResult.input.contact.phone, "09123456789");
  assert.ok(validResult.pricing.totals.totalRial > 0);
  assert.equal(validResult.output.document.fullName, "محمد محمدی");
  assert.equal(validResult.output.document.items.length, 1);
  assert.match(validResult.output.message, /محمد محمدی/);

  // Invalid request
  const invalidResult = prepareQuoteRequest(
    {
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
    },
    allEstimates,
  );

  assert.equal(invalidResult.validation.isValid, false);
  assert.ok(invalidResult.validation.errors.fullName);
  assert.ok(invalidResult.validation.errors.phone);
  assert.ok(invalidResult.validation.errors.destination);
  assert.ok(invalidResult.validation.errors.acceptDisclaimer);
  assert.ok(invalidResult.validation.errors["itemProduct-1"]);
  assert.ok(invalidResult.validation.errors["itemQuantity-1"]);
});

test("normalizeQuoteRequest and validateQuoteRequest operate on full request structures", () => {
  const normalized = normalizeQuoteRequest({
    contact: {
      fullName: "  حسین حسینی  ",
      phone: " ۰۹۱۲۱۱۱۱۱۱۱ ",
      destination: " شیراز ",
      notes: "   ",
    },
    items: [
      {
        id: 1,
        product: "میلگرد",
        quantity: "۱۰",
        unit: "شاخه",
        dimensions: "A3",
        rebarDiameterMm: "۱۴",
        pieceOptionKey: "",
      },
    ],
    acceptDisclaimer: true,
  });

  assert.equal(normalized.contact.fullName, "حسین حسینی");
  assert.equal(normalized.contact.phone, "09121111111");
  assert.equal(normalized.items[0].quantityNumeric, 10);
  assert.equal(normalized.acceptDisclaimer, true);

  const validation = validateQuoteRequest(normalized);
  assert.equal(validation.isValid, true);
  assert.equal(Object.keys(validation.errors).length, 0);
});

test("resolvePieceOption finds matching option by key", () => {
  const option = resolvePieceOption("beam:14", beamEstimate);
  assert.ok(option);
  assert.equal(option?.priceToman, 5_500_000);

  assert.equal(resolvePieceOption("unknown", beamEstimate), undefined);
  assert.equal(resolvePieceOption("", beamEstimate), undefined);
  assert.equal(resolvePieceOption("beam:14", undefined), undefined);
});

test("normalizePhone cleans dashes, spaces, and Persian digits", () => {
  assert.equal(normalizePhone("۰۹۱۲-۳۴۵-۶۷۸۹"), "09123456789");
  assert.equal(normalizePhone("(021) 88888888"), "02188888888");
});

test("deriveQuoteEstimates derives valid estimates from group catalogs", () => {
  const mockCatalogs = [
    {
      id: "rebar",
      label: "میلگرد",
      initialCategoryId: "ribbed",
      categories: [
        {
          id: "ribbed",
          label: "میلگرد آجدار",
          specificationLabel: "سایز",
          summary: { date: "۱۴۰۴/۱۲/۰۱", itemCount: 2, minPrice: 30000, maxPrice: 32000 },
          factories: [
            {
              id: "factory-1",
              name: "کارخانه نمونه",
              rows: [
                { unit: "کیلوگرم", price: 30000, size: "14" },
                { unit: "کیلوگرم", price: 32000, size: "16" },
              ],
            },
          ],
        },
      ],
    },
  ];

  const estimates = deriveQuoteEstimates(mockCatalogs);
  assert.ok(estimates.میلگرد);
  assert.equal(estimates.میلگرد?.unitPriceTomanPerKg, 31000);
  assert.equal(estimates.میلگرد?.minPriceTomanPerKg, 30000);
  assert.equal(estimates.میلگرد?.maxPriceTomanPerKg, 32000);
  assert.equal(estimates.میلگرد?.branchWeight, "rebar-12m");
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

test("validateQuantity accepts Persian decimal and integer inputs properly", () => {
  assert.equal(validateQuantity("۲/۵", "تن", 0), "");
  assert.equal(validateQuantity("۲٫۵", "کیلوگرم", 0), "");
  assert.equal(validateQuantity("۱۰", "شاخه", 0), "");
  assert.match(
    validateQuantity("۲/۵", "شاخه", 0),
    /عدد صحیح باشد/,
  );
});

test("rialToWords handles zero, negative, and normal values safely", async () => {
  const { rialToWords } = await import("../app/persian-numbers.ts");
  assert.equal(rialToWords(0), "صفر ریال");
  assert.equal(rialToWords(-100), "صفر ریال");
  assert.equal(rialToWords(1_000_000), "یک میلیون ریال");
  assert.equal(rialToWords(10_000_000), "ده میلیون ریال");
});

