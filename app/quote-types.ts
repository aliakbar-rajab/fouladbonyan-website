export const quoteDisclaimer =
  "ثبت این درخواست به معنی ثبت سفارش، انعقاد قرارداد، تضمین موجودی یا قطعی‌شدن قیمت نیست. قیمت و شرایط نهایی پس از بررسی واحد فروش در پیش‌فاکتور دارای مدت اعتبار اعلام می‌شود.";

export const quoteUnits = ["تن", "کیلوگرم", "شاخه", "عدد"] as const;
export type QuoteUnit = (typeof quoteUnits)[number];

export const quoteProductNames = [
  "میلگرد",
  "تیرآهن",
  "هاش",
  "ورق فولادی",
  "پروفیل و قوطی",
  "لوله فولادی",
  "نبشی",
  "ناودانی",
  "مفتول و سیم",
  "سایر محصولات فولادی",
] as const;
export type QuoteProductName = (typeof quoteProductNames)[number];

const quoteWeightOnlyProducts = new Set<QuoteProductName>([
  "هاش",
  "ورق فولادی",
  "پروفیل و قوطی",
  "نبشی",
  "ناودانی",
]);

/** Product capability is a domain rule, not a side effect of price loading. */
export function quoteProductSupportsPieceUnits(
  product: QuoteProductName | "",
): boolean {
  return !product || !quoteWeightOnlyProducts.has(product);
}

export function isQuoteUnit(value: unknown): value is QuoteUnit {
  return (
    typeof value === "string" &&
    (quoteUnits as readonly string[]).includes(value)
  );
}

export function isQuoteProduct(value: unknown): value is QuoteProductName {
  return (
    typeof value === "string" &&
    (quoteProductNames as readonly string[]).includes(value as QuoteProductName)
  );
}

/** One piece unit option resolved from catalog prices. */
export type QuotePieceOptionChoice = {
  key: string;
  label: string;
  unit: string;
  priceToman: number;
};

/** Raw input for one quote line item from the client form. */
export type RawQuoteItem = {
  id: number;
  product: QuoteProductName | "";
  quantity: string;
  unit: QuoteUnit;
  dimensions: string;
  rebarDiameterMm: string;
  pieceOptionKey: string;
};

/** Raw contact info submitted from the client form. */
export type RawQuoteContact = {
  fullName: string;
  phone: string;
  destination: string;
  notes: string;
};

/** Full raw form input structure. */
export type RawQuoteRequest = {
  contact: RawQuoteContact;
  items: RawQuoteItem[];
  acceptDisclaimer: boolean;
};

/** Evaluation result for a single quote line item. */
export type QuoteItemEvaluation = {
  id: number;
  product: QuoteProductName | "";
  quantity: string;
  quantityNumeric: number | null;
  unit: QuoteUnit;
  effectiveUnit: string;
  dimensions: string;
  rebarDiameterMm: string;
  rebarDiameterNumeric: number | null;
  pieceOptionKey: string;
  pieceOption?: QuotePieceOptionChoice;
  approximateTotalToman: number | null;
  approximateTotalRial: number | null;
  unitPriceRial: number | null;
  weightInKg: number | null;
  priceExplanation: string;
  supportsPieceUnits: boolean;
  requiresRebarDiameter: boolean;
};

/** Aggregated pricing totals across all items. */
export type QuoteTotals = {
  totalToman: number;
  totalRial: number;
  pricedItemCount: number;
  totalItemCount: number;
  hasAnyPriced: boolean;
};

/** Validation results. */
export type QuoteValidationResult = {
  isValid: boolean;
  errors: Record<string, string>;
};

/** Final printable line item structure in GeneratedQuote. */
export type GeneratedQuoteItem = {
  product: QuoteProductName;
  quantity: string;
  unit: string;
  dimensions: string;
  unitPriceRial: number | null;
  totalRial: number | null;
};

/** Final printable invoice document model. */
export type GeneratedQuote = {
  date: string;
  fullName: string;
  phone: string;
  destination: string;
  notes: string;
  items: GeneratedQuoteItem[];
  totalRial: number;
};

/** Complete evaluation output for a quote request. */
export type QuoteEvaluationResult = {
  input: {
    contact: RawQuoteContact;
    items: RawQuoteItem[];
    acceptDisclaimer: boolean;
  };
  validation: QuoteValidationResult;
  items: QuoteItemEvaluation[];
  totals: QuoteTotals;
  message: string;
  document: GeneratedQuote;
};
