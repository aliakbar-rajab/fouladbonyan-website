import {
  REBAR_STANDARD_BRANCH_LENGTH_M,
  tomanToRial,
  type QuoteProductName,
} from "./quote-pricing";
import {
  quoteDisclaimer,
  type GeneratedQuote,
  type PricedQuoteItem,
  type QuoteContact,
} from "./quote-types";

/*
 * The two things a submitted quote turns into: text the buyer copies into a
 * phone call, and the document they print. Both read the same priced rows, so
 * neither can quote a price or a unit the other does not.
 */

export const formatToman = (value: number) =>
  `${value.toLocaleString("fa-IR")} تومان`;

const persianNumber = (value: number) => value.toLocaleString("fa-IR");

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const persianToday = () => persianDateFormatter.format(new Date());

export const branchLengthLabel = () =>
  persianNumber(REBAR_STANDARD_BRANCH_LENGTH_M);

const grandTotalToman = (items: PricedQuoteItem[]) =>
  items.reduce((sum, priced) => sum + (priced.approximateTotal ?? 0), 0);

function priceDescription(priced: PricedQuoteItem) {
  const { estimate, approximateTotal, pieceOption } = priced;
  if (approximateTotal === null || !estimate) {
    return " | قیمت تقریبی: نیازمند بررسی واحد فروش";
  }
  if (pieceOption) {
    return ` | قیمت تقریبی: ${formatToman(approximateTotal)} (بر اساس قیمت واقعی سایت برای این آیتم: ${formatToman(pieceOption.priceToman)} برای هر ${pieceOption.unit})`;
  }
  return ` | قیمت تقریبی: ${formatToman(approximateTotal)} (مبنای محاسبه: ${formatToman(estimate.unitPriceTomanPerKg)} برای هر کیلوگرم)`;
}

/** The text the buyer copies and reads out to the sales desk. */
export function buildQuoteMessage(
  contact: QuoteContact,
  items: PricedQuoteItem[],
): string {
  const anyPriced = items.some(
    (priced) => priced.approximateTotal !== null,
  );

  return [
    "درخواست پیش‌فاکتور غیرقطعی",
    `نام: ${contact.fullName}`,
    `شماره تماس: ${contact.phone}`,
    "",
    `کالاهای درخواست (${persianNumber(items.length)} کالا):`,
    ...items.map(
      (priced, index) =>
        `${persianNumber(index + 1)}) ${priced.item.product.trim()} | ${priced.item.quantity.trim()} ${priced.effectiveUnit} | ابعاد/استاندارد: ${priced.item.dimensions.trim() || "اعلام نشده"}${priceDescription(priced)}`,
    ),
    "",
    `جمع تقریبی: ${
      anyPriced ? formatToman(grandTotalToman(items)) : "محاسبه نشده"
    }`,
    "قیمت‌های تقریبی بالا صرفاً اطلاع‌رسانی هستند و ممکن است همه کالاها را پوشش ندهند.",
    "",
    `شهر مقصد: ${contact.destination}`,
    `توضیحات: ${contact.notes || "ندارد"}`,
    "",
    quoteDisclaimer,
  ].join("\n");
}

/** The printable document, with totals stated in rial. */
export function buildGeneratedQuote(
  contact: QuoteContact,
  items: PricedQuoteItem[],
): GeneratedQuote {
  return {
    date: persianToday(),
    ...contact,
    items: items.map((priced) => {
      const totalRial =
        priced.approximateTotal === null
          ? null
          : tomanToRial(priced.approximateTotal);
      const quantity = Number(priced.item.quantity);

      return {
        product: priced.item.product as QuoteProductName,
        quantity: priced.item.quantity,
        unit: priced.effectiveUnit,
        dimensions: priced.item.dimensions,
        unitPriceRial:
          totalRial === null || !quantity
            ? null
            : Math.round(totalRial / quantity),
        totalRial,
      };
    }),
    totalRial: tomanToRial(grandTotalToman(items)),
  };
}
