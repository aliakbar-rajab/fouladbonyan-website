import { calculateRebarWeight } from "./catalog-behavior.mjs";
import { toAsciiDigits } from "./site-logic.mjs";
import {
  quoteDisclaimer,
  quoteProductNames,
  type DerivedQuoteItem,
  type GeneratedQuote,
  type NormalizedQuoteContact,
  type NormalizedQuoteItem,
  type QuotePieceOption,
  type QuotePriceEstimate,
  type QuotePriceEstimates,
  type QuoteProductName,
  type QuoteRequestResult,
  type QuoteTotals,
  type QuoteUnit,
  type QuoteValidationResult,
  type RawQuoteContact,
  type RawQuoteItem,
  type RawQuoteRequest,
} from "./quote-types";

export const RIAL_PER_TOMAN = 10;
export const tomanToRial = (toman: number) => toman * RIAL_PER_TOMAN;
export const REBAR_STANDARD_BRANCH_LENGTH_M = 12;

export const formatToman = (value: number) =>
  `${value.toLocaleString("fa-IR")} تومان`;

export const formatPersianNumber = (value: number) =>
  value.toLocaleString("fa-IR");

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const persianToday = () => persianDateFormatter.format(new Date());

export const branchLengthLabel = () =>
  formatPersianNumber(REBAR_STANDARD_BRANCH_LENGTH_M);

export const isPieceUnit = (unit: string): boolean =>
  unit === "شاخه" || unit === "عدد";

export const itemIndexLabel = (index: number) =>
  formatPersianNumber(index + 1);

const iranianPhonePattern = /^(?:\+98|0098|98|0)?(?:9\d{9}|21\d{8})$/;

export function normalizePhone(value: string): string {
  return toAsciiDigits(value ?? "").replace(/[\s()-]/g, "");
}

export function calculateApproximateTotal(
  unitPriceTomanPerKg: number,
  quantity: number,
  unit: string,
): number | null {
  if (
    !Number.isFinite(unitPriceTomanPerKg) ||
    unitPriceTomanPerKg <= 0 ||
    !Number.isFinite(quantity) ||
    quantity <= 0
  ) {
    return null;
  }

  const weightInKg =
    unit === "تن" ? quantity * 1_000 : unit === "کیلوگرم" ? quantity : null;
  if (weightInKg === null) return null;

  return Math.round(unitPriceTomanPerKg * weightInKg);
}

export function parsePersianNumber(value: string): number | null {
  if (!value) return null;
  const ascii = toAsciiDigits(value.trim())
    .replace(/[/٫]/g, ".")
    .replace(/[,٬]/g, "");
  const parsed = Number(ascii);
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// 1. NORMALIZATION
// ---------------------------------------------------------------------------

export function normalizeQuoteContact(
  raw: Partial<RawQuoteContact> | null | undefined,
): NormalizedQuoteContact {
  return {
    fullName: (raw?.fullName ?? "").trim(),
    phone: normalizePhone(raw?.phone ?? ""),
    destination: (raw?.destination ?? "").trim(),
    notes: (raw?.notes ?? "").trim(),
  };
}

export function normalizeQuoteItem(
  raw: Partial<RawQuoteItem> | null | undefined,
): NormalizedQuoteItem {
  const rawQuantity = String(raw?.quantity ?? "").trim();
  const rawDiameter = String(raw?.rebarDiameterMm ?? "").trim();
  const quantityNumeric = parsePersianNumber(rawQuantity);
  const rebarDiameterNumeric = parsePersianNumber(rawDiameter);

  const rawProduct = raw?.product ?? "";
  const product: QuoteProductName | "" = (
    quoteProductNames as readonly string[]
  ).includes(rawProduct)
    ? (rawProduct as QuoteProductName)
    : "";

  const rawUnit = raw?.unit ?? "تن";
  const unit: QuoteUnit =
    rawUnit === "کیلوگرم" || rawUnit === "شاخه" || rawUnit === "عدد"
      ? rawUnit
      : "تن";

  return {
    id: raw?.id ?? 1,
    product,
    quantity: rawQuantity,
    quantityNumeric,
    unit,
    dimensions: String(raw?.dimensions ?? "").trim(),
    rebarDiameterMm: rawDiameter,
    rebarDiameterNumeric,
    pieceOptionKey: String(raw?.pieceOptionKey ?? "").trim(),
  };
}

export function normalizeQuoteRequest(
  raw: RawQuoteRequest,
): {
  contact: NormalizedQuoteContact;
  items: NormalizedQuoteItem[];
  acceptDisclaimer: boolean;
} {
  return {
    contact: normalizeQuoteContact(raw.contact),
    items: (raw.items ?? []).map(normalizeQuoteItem),
    acceptDisclaimer: Boolean(raw.acceptDisclaimer),
  };
}

// ---------------------------------------------------------------------------
// 2. VALIDATION
// ---------------------------------------------------------------------------

export const DISCLAIMER_ERROR =
  "برای آماده‌سازی درخواست باید متن غیرقطعی‌بودن درخواست را تأیید کنید.";

export function validateFullName(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "نام و نام خانوادگی را وارد کنید.";
  if (normalized.length < 3) return "نام واردشده باید حداقل ۳ حرف باشد.";
  return "";
}

export function validatePhone(value: string): string {
  const normalized = normalizePhone(value);
  if (!normalized) return "شماره تماس را وارد کنید.";
  if (!iranianPhonePattern.test(normalized)) {
    return "شماره تماس معتبر ایرانی وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.";
  }
  return "";
}

export function validateDestination(value: string): string {
  return value.trim() ? "" : "شهر مقصد را وارد کنید.";
}

export function validateQuantity(
  quantityInput: string,
  unit: string,
  index: number,
): string {
  const label = `مقدار تقریبی کالای ${itemIndexLabel(index)}`;
  if (!quantityInput.trim()) {
    return `${label} را وارد کنید.`;
  }
  const numeric = parsePersianNumber(quantityInput);
  if (numeric === null || numeric <= 0) {
    return `${label} باید عددی بزرگ‌تر از صفر باشد.`;
  }
  if (isPieceUnit(unit) && !Number.isInteger(numeric)) {
    return `${label} برای واحد ${unit} باید عدد صحیح باشد.`;
  }
  return "";
}

export function validateQuoteRequest(
  input: {
    contact: NormalizedQuoteContact;
    items: NormalizedQuoteItem[];
    acceptDisclaimer: boolean;
  },
): QuoteValidationResult {
  const errors: Record<string, string> = {};

  const nameError = validateFullName(input.contact.fullName);
  if (nameError) errors.fullName = nameError;

  const phoneError = validatePhone(input.contact.phone);
  if (phoneError) errors.phone = phoneError;

  const destinationError = validateDestination(input.contact.destination);
  if (destinationError) errors.destination = destinationError;

  if (!input.acceptDisclaimer) {
    errors.acceptDisclaimer = DISCLAIMER_ERROR;
  }

  for (const [index, item] of input.items.entries()) {
    if (!item.product) {
      errors[`itemProduct-${item.id}`] = `نوع کالای ${itemIndexLabel(index)} را وارد کنید.`;
    }
    const quantityError = validateQuantity(item.quantity, item.unit, index);
    if (quantityError) {
      errors[`itemQuantity-${item.id}`] = quantityError;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// ---------------------------------------------------------------------------
// 3. OPTION RESOLUTION & PRICING DERIVATION
// ---------------------------------------------------------------------------

export function resolvePieceOption(
  pieceOptionKey: string,
  estimate: QuotePriceEstimate | undefined,
): QuotePieceOption | undefined {
  if (!pieceOptionKey || !estimate?.pieceOptions) return undefined;
  return estimate.pieceOptions.find((option) => option.key === pieceOptionKey);
}

export function deriveQuoteItemPricing(
  rawItem: Partial<RawQuoteItem> | NormalizedQuoteItem,
  estimates: QuotePriceEstimates | null | undefined,
): DerivedQuoteItem {
  const item =
    "quantityNumeric" in rawItem
      ? (rawItem as NormalizedQuoteItem)
      : normalizeQuoteItem(rawItem);

  const estimate =
    item.product && estimates ? estimates[item.product] : undefined;
  const pieceOption = resolvePieceOption(item.pieceOptionKey, estimate);
  const effectiveUnit = pieceOption?.unit ?? item.unit;

  let approximateTotalToman: number | null = null;
  let weightInKg: number | null = null;

  const qty = item.quantityNumeric;

  if (estimate && qty !== null && qty > 0) {
    if (pieceOption) {
      approximateTotalToman = Math.round(pieceOption.priceToman * qty);
    } else if (item.unit === "تن" || item.unit === "کیلوگرم") {
      weightInKg = item.unit === "تن" ? qty * 1_000 : qty;
      approximateTotalToman = Math.round(
        estimate.unitPriceTomanPerKg * weightInKg,
      );
    } else if (
      estimate.branchWeight === "rebar-12m" &&
      item.rebarDiameterNumeric !== null &&
      item.rebarDiameterNumeric > 0
    ) {
      const calculatedWeight = calculateRebarWeight(
        item.rebarDiameterNumeric,
        REBAR_STANDARD_BRANCH_LENGTH_M,
        Math.trunc(qty),
      );
      if (calculatedWeight) {
        weightInKg = calculatedWeight;
        approximateTotalToman = Math.round(
          estimate.unitPriceTomanPerKg * calculatedWeight,
        );
      }
    }
  }

  const approximateTotalRial =
    approximateTotalToman === null ? null : tomanToRial(approximateTotalToman);

  const unitPriceRial =
    approximateTotalRial === null || !qty
      ? null
      : Math.round(approximateTotalRial / qty);

  return {
    id: item.id,
    item,
    estimate,
    pieceOption,
    effectiveUnit,
    approximateTotalToman,
    approximateTotalRial,
    unitPriceRial,
    weightInKg,
  };
}

export function deriveQuotePricing(
  items: (Partial<RawQuoteItem> | NormalizedQuoteItem)[],
  estimates: QuotePriceEstimates | null | undefined,
): { items: DerivedQuoteItem[]; totals: QuoteTotals } {
  const derivedItems = items.map((item) =>
    deriveQuoteItemPricing(item, estimates),
  );

  let totalToman = 0;
  let totalRial = 0;
  let pricedItemCount = 0;

  for (const derived of derivedItems) {
    if (derived.approximateTotalToman !== null) {
      totalToman += derived.approximateTotalToman;
      totalRial += derived.approximateTotalRial ?? 0;
      pricedItemCount += 1;
    }
  }

  return {
    items: derivedItems,
    totals: {
      totalToman,
      totalRial,
      pricedItemCount,
      totalItemCount: derivedItems.length,
      hasAnyPriced: pricedItemCount > 0,
    },
  };
}

// ---------------------------------------------------------------------------
// 4. OUTPUT SERIALIZATION
// ---------------------------------------------------------------------------

function priceLineDescription(priced: DerivedQuoteItem): string {
  const { estimate, approximateTotalToman, pieceOption } = priced;
  if (approximateTotalToman === null || !estimate) {
    return " | قیمت تقریبی: نیازمند بررسی واحد فروش";
  }
  if (pieceOption) {
    return ` | قیمت تقریبی: ${formatToman(approximateTotalToman)} (بر اساس قیمت واقعی سایت برای این آیتم: ${formatToman(pieceOption.priceToman)} برای هر ${pieceOption.unit})`;
  }
  return ` | قیمت تقریبی: ${formatToman(approximateTotalToman)} (مبنای محاسبه: ${formatToman(estimate.unitPriceTomanPerKg)} برای هر کیلوگرم)`;
}

export function buildQuoteMessage(
  contact: NormalizedQuoteContact,
  items: DerivedQuoteItem[],
  totals: QuoteTotals,
): string {
  return [
    "درخواست پیش‌فاکتور غیرقطعی",
    `نام: ${contact.fullName}`,
    `شماره تماس: ${contact.phone}`,
    "",
    `کالاهای درخواست (${formatPersianNumber(items.length)} کالا):`,
    ...items.map(
      (priced, index) =>
        `${formatPersianNumber(index + 1)}) ${priced.item.product.trim()} | ${priced.item.quantity.trim()} ${priced.effectiveUnit} | ابعاد/استاندارد: ${priced.item.dimensions.trim() || "اعلام نشده"}${priceLineDescription(priced)}`,
    ),
    "",
    `جمع تقریبی: ${
      totals.hasAnyPriced ? formatToman(totals.totalToman) : "محاسبه نشده"
    }`,
    "قیمت‌های تقریبی بالا صرفاً اطلاع‌رسانی هستند و ممکن است همه کالاها را پوشش ندهند.",
    "",
    `شهر مقصد: ${contact.destination}`,
    `توضیحات: ${contact.notes || "ندارد"}`,
    "",
    quoteDisclaimer,
  ].join("\n");
}

export function buildQuoteDocument(
  contact: NormalizedQuoteContact,
  items: DerivedQuoteItem[],
  totals: QuoteTotals,
): GeneratedQuote {
  return {
    date: persianToday(),
    ...contact,
    items: items.map((priced) => ({
      product: priced.item.product as QuoteProductName,
      quantity: priced.item.quantity,
      unit: priced.effectiveUnit,
      dimensions: priced.item.dimensions,
      unitPriceRial: priced.unitPriceRial,
      totalRial: priced.approximateTotalRial,
    })),
    totalRial: totals.totalRial,
  };
}

// ---------------------------------------------------------------------------
// 5. UNIFIED DOMAIN PIPELINE
// ---------------------------------------------------------------------------

export function prepareQuoteRequest(
  rawInput: RawQuoteRequest,
  estimates: QuotePriceEstimates | null | undefined,
): QuoteRequestResult {
  const input = normalizeQuoteRequest(rawInput);
  const validation = validateQuoteRequest(input);
  const pricing = deriveQuotePricing(input.items, estimates);
  const output = {
    message: buildQuoteMessage(input.contact, pricing.items, pricing.totals),
    document: buildQuoteDocument(input.contact, pricing.items, pricing.totals),
  };

  return {
    input,
    validation,
    pricing,
    output,
  };
}
