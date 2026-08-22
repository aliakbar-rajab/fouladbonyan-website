import type {
  QuotePieceOption,
  QuotePriceEstimate,
  QuoteProductName,
} from "./quote-pricing";

export const quoteDisclaimer =
  "ثبت این درخواست به معنی ثبت سفارش، انعقاد قرارداد، تضمین موجودی یا قطعی‌شدن قیمت نیست. قیمت و شرایط نهایی پس از بررسی واحد فروش در پیش‌فاکتور دارای مدت اعتبار اعلام می‌شود.";

export const quoteUnits = ["تن", "کیلوگرم", "شاخه", "عدد"] as const;

export type QuoteUnit = (typeof quoteUnits)[number];

export function isQuoteUnit(value: unknown): value is QuoteUnit {
  return typeof value === "string" && (quoteUnits as readonly string[]).includes(value);
}

/** One row of the form, exactly as the buyer filled it in. */
export type QuoteItem = {
  id: number;
  product: QuoteProductName | "";
  quantity: string;
  unit: QuoteUnit;
  dimensions: string;
  rebarDiameterMm: string;
  // Key of a real catalog item, for products whose estimate carries
  // pieceOptions (e.g. a specific تیرآهن size or a specific رابیتس/توری
  // product) — determines both the real unit and real price.
  pieceOptionKey: string;
};

/**
 * One row with everything derived from it. This is the only derivation: the
 * price hints, the prepared text and the generated document all read it, so
 * none of them can disagree about what a row costs or how it is sold.
 */
export type PricedQuoteItem = {
  item: QuoteItem;
  estimate: QuotePriceEstimate | undefined;
  approximateTotal: number | null;
  pieceOption: QuotePieceOption | undefined;
  /**
   * The real, effective unit charged. A catalog pieceOption (برگ/طاقه‌ای/
   * مترمربع/...) overrides the form's plain واحد dropdown.
   */
  effectiveUnit: string;
};

/** Who the request is from and where it is going. */
export type QuoteContact = {
  fullName: string;
  phone: string;
  destination: string;
  notes: string;
};

type GeneratedQuoteItem = {
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
