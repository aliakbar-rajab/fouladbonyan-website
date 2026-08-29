import { formatCatalogNumber } from "../catalog-utils";
import {
  quoteDisclaimer,
  type GeneratedQuote,
  type QuoteItemEvaluation,
  type QuoteProductName,
  type QuoteTotals,
  type RawQuoteContact,
} from "../quote-types";
import { formatToman } from "./calculation";

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
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
    `کالاهای درخواست (${formatCatalogNumber(items.length)} کالا):`,
    ...items.map(
      (priced, index) =>
        `${formatCatalogNumber(index + 1)}) ${priced.product.trim()} | ${priced.quantity.trim()} ${priced.effectiveUnit} | ابعاد/استاندارد: ${priced.dimensions.trim() || "اعلام نشده"}${priceLineDescription(priced)}`,
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

export function buildQuoteDocument(
  contact: RawQuoteContact,
  items: QuoteItemEvaluation[],
  totals: QuoteTotals,
): GeneratedQuote {
  return {
    date: persianToday(),
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
  };
}
