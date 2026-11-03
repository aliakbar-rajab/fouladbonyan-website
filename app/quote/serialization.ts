import { formatPersianNumber } from "../persian-numbers.mjs";
import {
  quoteDisclaimer,
  type GeneratedQuote,
  type QuoteItemEvaluation,
  type QuoteTotals,
  type RawQuoteContact,
} from "../quote-types";
import { formatToman } from "./calculation";
import type { QuoteProductName } from "./products";

// Pinned to Tehran like every other formatter on the site: the date on a quote
// is the seller's business date, not the reader's, and without the zone a
// visitor abroad could print one a day off.
const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Tehran",
});

export const persianToday = () => persianDateFormatter.format(new Date());

function priceLineDescription(priced: QuoteItemEvaluation): string {
  const { approximateTotalToman, pieceOption, weightInKg } = priced;
  if (approximateTotalToman === null) {
    return " | قیمت تقریبی: نیازمند بررسی واحد فروش";
  }
  if (pieceOption) {
    return ` | قیمت تقریبی: ${formatToman(approximateTotalToman)} (بر اساس قیمت واقعی سایت برای این آیتم: ${formatToman(pieceOption.priceToman)} برای هر ${pieceOption.unit})`;
  }
  const kgPrice =
    weightInKg && weightInKg > 0
      ? Math.round(approximateTotalToman / weightInKg)
      : null;
  if (kgPrice !== null) {
    return ` | قیمت تقریبی: ${formatToman(approximateTotalToman)} (مبنای محاسبه: ${formatToman(kgPrice)} برای هر کیلوگرم)`;
  }
  return ` | قیمت تقریبی: ${formatToman(approximateTotalToman)}`;
}

export function buildQuoteMessage(
  contact: RawQuoteContact,
  items: QuoteItemEvaluation[],
  totals: QuoteTotals,
): string {
  return [
    "درخواست پیش‌فاکتور غیرقطعی",
    `نام: ${contact.fullName.trim()}`,
    `شماره تماس: ${contact.phone.trim()}`,
    "",
    `کالاهای درخواست (${formatPersianNumber(items.length)} کالا):`,
    ...items.map(
      (priced, index) =>
        `${formatPersianNumber(index + 1)}) ${priced.product.trim()} | ${priced.quantity.trim()} ${priced.effectiveUnit} | ابعاد/استاندارد: ${priced.dimensions.trim() || "اعلام نشده"}${priceLineDescription(priced)}`,
    ),
    "",
    `جمع تقریبی: ${
      totals.hasAnyPriced ? formatToman(totals.totalToman) : "محاسبه نشده"
    }`,
    "قیمت‌های تقریبی بالا صرفاً اطلاع‌رسانی هستند و ممکن است همه کالاها را پوشش ندهند.",
    "",
    `شهر مقصد: ${contact.destination.trim()}`,
    `توضیحات: ${contact.notes.trim() || "ندارد"}`,
    "",
    quoteDisclaimer,
  ].join("\n");
}

/**
 * VAT on a rial amount, rounded half-up to the rial -- the standalone invoice
 * app's rule (computeTotals in its invoice-totals.js). The rate is carried as
 * basis points and the product taken in BigInt so neither a fractional rate
 * nor a large total can pick up a floating-point error.
 */
export function quoteTaxRial(totalRial: number, taxRate: number | null): number {
  if (!taxRate || taxRate <= 0 || totalRial <= 0) return 0;
  const basisPoints = BigInt(Math.round(taxRate * 10_000));
  const product = BigInt(Math.round(totalRial)) * basisPoints;
  return Number((product + 5_000n) / 10_000n);
}

export function buildQuoteDocument(
  contact: RawQuoteContact,
  items: QuoteItemEvaluation[],
  totals: QuoteTotals,
  taxRate: number | null = null,
): GeneratedQuote {
  const taxRial = quoteTaxRial(totals.totalRial, taxRate);
  return {
    date: persianToday(),
    number: "",
    fullName: contact.fullName.trim(),
    phone: contact.phone.trim(),
    destination: contact.destination.trim(),
    notes: contact.notes.trim(),
    items: items.map((priced) => ({
      product: priced.product as QuoteProductName,
      quantity: priced.quantity,
      unit: priced.effectiveUnit,
      dimensions: priced.dimensions,
      unitPriceRial: priced.unitPriceRial,
      totalRial: priced.approximateTotalRial,
    })),
    totalRial: totals.totalRial,
    pricedItemCount: totals.pricedItemCount,
    taxRate,
    taxRial,
    payableRial: totals.totalRial + taxRial,
  };
}
