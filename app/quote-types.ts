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
export type QuotePieceOption = {
  key: string;
  label: string;
  unit: string;
  priceToman: number;
};

/** Price estimate summary derived from catalog data for a product. */
export type QuotePriceEstimate = {
  product: QuoteProductName;
  unitPriceTomanPerKg: number;
  minPriceTomanPerKg: number;
  maxPriceTomanPerKg: number;
  rowCount: number;
  date: string;
  pieceOptions?: QuotePieceOption[];
  branchWeight?: "rebar-12m";
  supportsPieceUnits: boolean;
};

export type QuotePriceEstimates = Partial<
  Record<QuoteProductName, QuotePriceEstimate>
>;

/** Raw input for one quote row. */
export type RawQuoteItem = {
  id: number;
  product: QuoteProductName | "";
  quantity: string;
  unit: QuoteUnit;
  dimensions: string;
  rebarDiameterMm: string;
  pieceOptionKey: string;
};

/** Alias for backward-compatibility */
export type QuoteItem = RawQuoteItem;

/** Raw contact info. */
export type RawQuoteContact = {
  fullName: string;
  phone: string;
  destination: string;
  notes: string;
};

export type QuoteContact = RawQuoteContact;

/** Full raw form input. */
export type RawQuoteRequest = {
  contact: RawQuoteContact;
  items: RawQuoteItem[];
  acceptDisclaimer: boolean;
};

/** Normalized contact info with cleaned digits and trimmed strings. */
export type NormalizedQuoteContact = {
  fullName: string;
  phone: string;
  destination: string;
  notes: string;
};

/** Normalized item with numeric values parsed from Persian/Arabic/ASCII digits. */
export type NormalizedQuoteItem = {
  id: number;
  product: QuoteProductName | "";
  quantity: string;
  quantityNumeric: number | null;
  unit: QuoteUnit;
  dimensions: string;
  rebarDiameterMm: string;
  rebarDiameterNumeric: number | null;
  pieceOptionKey: string;
};

/** Result of pricing derivation for a single item. */
export type DerivedQuoteItem = {
  id: number;
  item: NormalizedQuoteItem;
  estimate: QuotePriceEstimate | undefined;
  pieceOption: QuotePieceOption | undefined;
  effectiveUnit: string;
  approximateTotalToman: number | null;
  approximateTotalRial: number | null;
  unitPriceRial: number | null;
  weightInKg: number | null;
};

/** Backwards-compatible alias for PricedQuoteItem */
export type PricedQuoteItem = {
  item: QuoteItem;
  estimate: QuotePriceEstimate | undefined;
  approximateTotal: number | null;
  pieceOption: QuotePieceOption | undefined;
  effectiveUnit: string;
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

/** Final printable invoice structure. */
export type GeneratedQuoteItem = {
  product: QuoteProductName;
  quantity: string;
  unit: string;
  dimensions: string;
  unitPriceRial: number | null;
  totalRial: number | null;
};

export type GeneratedQuote = {
  date: string;
  fullName: string;
  phone: string;
  destination: string;
  notes: string;
  items: GeneratedQuoteItem[];
  totalRial: number;
};

/** Result of prepareQuoteRequest. */
export type QuoteRequestResult = {
  input: {
    contact: NormalizedQuoteContact;
    items: NormalizedQuoteItem[];
    acceptDisclaimer: boolean;
  };
  validation: QuoteValidationResult;
  pricing: {
    items: DerivedQuoteItem[];
    totals: QuoteTotals;
  };
  output: {
    message: string;
    document: GeneratedQuote;
  };
};

