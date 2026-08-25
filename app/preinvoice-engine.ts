/*
 * Pure calculation/validation engine for the pre-invoice builder, ported from
 * the standalone پیش‌فاکتور app's recalcAll/suggestInvoiceNumber and friends
 * (js/app.js). Operates on plain data rather than the DOM so it plugs into
 * React state instead of imperative DOM manipulation.
 */
import { toPersianDigits } from "./site-logic.mjs";
import {
  bigRoundDiv,
  formatBigRial,
  rialToWordsBig,
  strictMoney,
  strictPercent,
  strictQuantity,
} from "./preinvoice-numbers";
import {
  DEFAULT_VALIDITY_MODE,
  readInvoiceDate,
  resolveValidityValue,
  todayJalaliString,
} from "./preinvoice-dates";
import type {
  InvoiceData,
  InvoiceItem,
  InvoiceOrientation,
  InvoiceTotals,
  RowCalculation,
} from "./preinvoice-types";

export const DEFAULT_ROWS_BY_ORIENTATION: Record<InvoiceOrientation, number> = {
  landscape: 7,
  portrait: 14,
};

export function defaultInvoiceRowCount(orientation: InvoiceOrientation): number {
  return DEFAULT_ROWS_BY_ORIENTATION[orientation];
}

export function makeBlankRow(id: number): InvoiceItem {
  return { id, description: "", quantity: "", unit: "", unitPrice: "", discount: "" };
}

export function makeBlankRows(count: number, startId: number): InvoiceItem[] {
  return Array.from({ length: count }, (_, index) => makeBlankRow(startId + index));
}

export function rowIsBlank(item: InvoiceItem): boolean {
  return !item.description.trim() && !item.quantity.trim() && !item.unit.trim() &&
    !item.unitPrice.trim() && !item.discount.trim();
}

const SEQ_KEY = "preinvoice.dailySeq.fouladBonyanDaria";

function dateDigitsOnly(value: string): string {
  const ascii = value.replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) & 0xf)).replace(/[^0-9]/g, "");
  return /^\d{8}$/.test(ascii) ? ascii : "";
}

/**
 * Number suggestions are side-effect free: merely opening the app or loading
 * a document must never consume an accounting number. The counter only
 * advances when the document is actually saved or printed (see
 * commitInvoiceNumber).
 */
export function suggestInvoiceNumber(invoiceDate: string): string {
  const datePart = dateDigitsOnly(invoiceDate) || dateDigitsOnly(todayJalaliString());
  if (!datePart) return "";

  let next = 1;
  try {
    const saved = JSON.parse(localStorage.getItem(SEQ_KEY) || "null");
    if (saved && saved.day === datePart) next = (saved.n || 0) + 1;
  } catch {
    next = 1;
  }

  let suffix = String(next);
  while (suffix.length < 3) suffix = "0" + suffix;
  return toPersianDigits(datePart + "-" + suffix);
}

export function commitInvoiceNumber(number: string): void {
  const ascii = number.replace(/[۰-۹٠-٩]/g, (d) => String(d.charCodeAt(0) & 0xf));
  const match = ascii.match(/^(\d{8})-(\d+)$/);
  if (!match) return;
  const day = match[1];
  const n = parseInt(match[2], 10);
  if (!n) return;
  try {
    const saved = JSON.parse(localStorage.getItem(SEQ_KEY) || "null");
    if (!saved || saved.day !== day || (saved.n || 0) < n) {
      localStorage.setItem(SEQ_KEY, JSON.stringify({ day, n }));
    }
  } catch {
    // Storage can be disabled in private mode; numbering must not block the editor.
  }
}

export function blankInvoiceData(nextRowId: { current: number }): InvoiceData {
  const invoiceDate = todayJalaliString();
  const orientation: InvoiceOrientation = "landscape";
  const items = makeBlankRows(defaultInvoiceRowCount(orientation), nextRowId.current);
  nextRowId.current += items.length;
  return {
    version: 1,
    orientation,
    headerGray: true,
    meta: {
      title: "پیش‌فاکتور",
      date: invoiceDate,
      number: suggestInvoiceNumber(invoiceDate),
      validityMode: DEFAULT_VALIDITY_MODE,
      validity: resolveValidityValue(DEFAULT_VALIDITY_MODE, invoiceDate),
    },
    buyer: { name: "", nationalId: "", address: "", postalCode: "", phone: "" },
    taxPercent: "۱۰",
    notes: "",
    includeStamp: true,
    items,
  };
}

const TAX_PERCENT_ERROR = "درصد مالیات باید عددی بین ۰ تا ۱۰۰ و حداکثر با دو رقم اعشار باشد";
const INVOICE_DATE_ERROR = "تاریخ پیش‌فاکتور یک تاریخ معتبر شمسی نیست (نمونه: ۱۴۰۴/۰۶/۳۱)";

/**
 * Recalculates every row's total/afterDiscount and the document's totals,
 * mirroring recalcAll in the standalone app. Invalid quantity/price excludes
 * a row from the sums; an invalid or excessive discount is neutralized to
 * zero rather than corrupting an otherwise-healthy row.
 */
export function calculateInvoiceTotals(data: Pick<InvoiceData, "items" | "taxPercent" | "meta">): InvoiceTotals {
  let filledRows = 0;
  let gross = 0n;
  let discountSum = 0n;
  let afterDiscountSum = 0n;
  const calculationErrors: string[] = [];
  const financialBlockingErrors: string[] = [];

  const rows: RowCalculation[] = data.items.map((item, index) => {
    const rowNumber = index + 1;
    const blank = rowIsBlank(item);
    if (blank) {
      return {
        item,
        rowNumber,
        blank: true,
        total: null,
        afterDiscount: null,
        descriptionError: false,
        quantityError: false,
        unitPriceError: false,
        discountError: false,
      };
    }
    filledRows += 1;

    const descriptionError = !item.description.trim();
    if (descriptionError) calculationErrors.push(`ردیف ${toPersianDigits(rowNumber)}: شرح کالا یا خدمت وارد نشده است`);

    const qty = strictQuantity(item.quantity);
    if (!qty.valid) {
      calculationErrors.push(`ردیف ${toPersianDigits(rowNumber)}: تعداد/مقدار معتبر نیست`);
      financialBlockingErrors.push(`ردیف ${toPersianDigits(rowNumber)}: تعداد/مقدار معتبر نیست`);
    }

    const price = strictMoney(item.unitPrice, false);
    if (!price.valid) {
      calculationErrors.push(`ردیف ${toPersianDigits(rowNumber)}: مبلغ واحد معتبر نیست`);
      financialBlockingErrors.push(`ردیف ${toPersianDigits(rowNumber)}: مبلغ واحد معتبر نیست`);
    }

    const discount = strictMoney(item.discount, true);
    if (!discount.valid) {
      calculationErrors.push(`ردیف ${toPersianDigits(rowNumber)}: تخفیف معتبر نیست`);
      financialBlockingErrors.push(`ردیف ${toPersianDigits(rowNumber)}: تخفیف معتبر نیست`);
    }

    let total: bigint | null = null;
    let afterDiscount: bigint | null = null;
    let rowTotal = 0n;
    if (qty.valid && price.valid) rowTotal = bigRoundDiv(qty.value * price.value, 1000n);
    const discountExceeds = discount.valid && qty.valid && price.valid && discount.value > rowTotal;
    if (discountExceeds) {
      calculationErrors.push(`ردیف ${toPersianDigits(rowNumber)}: تخفیف از مبلغ کل ردیف بیشتر است`);
      financialBlockingErrors.push(`ردیف ${toPersianDigits(rowNumber)}: تخفیف از مبلغ کل ردیف بیشتر است`);
    }

    if (qty.valid && price.valid) {
      const usableDiscount = discount.valid && discount.value <= rowTotal ? discount.value : 0n;
      total = rowTotal;
      afterDiscount = rowTotal - usableDiscount;
      gross += rowTotal;
      discountSum += usableDiscount;
      afterDiscountSum += afterDiscount;
    }

    return {
      item,
      rowNumber,
      blank: false,
      total,
      afterDiscount,
      descriptionError,
      quantityError: !qty.valid,
      unitPriceError: !price.valid,
      discountError: !discount.valid || discountExceeds,
    };
  });

  const tax = strictPercent(data.taxPercent);
  const taxPercentError = !tax.valid;
  if (taxPercentError) {
    calculationErrors.push(TAX_PERCENT_ERROR);
    financialBlockingErrors.push(TAX_PERCENT_ERROR);
  }
  const usableTax = tax.valid ? tax.value : 0n;
  const taxTotal = bigRoundDiv(afterDiscountSum * usableTax, 10000n);
  const netTotal = afterDiscountSum + taxTotal;

  const dateError = readInvoiceDate(data.meta.date).kind === "invalid";
  if (dateError) calculationErrors.push(INVOICE_DATE_ERROR);

  return {
    rows,
    filledRows,
    grossTotal: gross,
    discountTotal: discountSum,
    afterDiscountTotal: afterDiscountSum,
    taxTotal,
    netTotal,
    taxPercentError,
    dateError,
    calculationErrors,
    financialBlockingErrors,
  };
}

export function formatMoneyOrDash(value: bigint, filledRows: number): string {
  return filledRows ? formatBigRial(value) + " ریال" : "";
}

export function netTotalWords(netTotal: bigint, filledRows: number): string {
  return filledRows ? rialToWordsBig(netTotal) : "";
}

/**
 * Document-level warnings required only for Print/Save, layered on top of
 * calculationErrors — mirrors validateInvoiceForOutput in the standalone app.
 */
export function validateInvoiceForOutput(data: InvoiceData, totals: InvoiceTotals): string[] {
  const errors = totals.calculationErrors.slice();
  if (!data.meta.date.trim()) errors.push("تاریخ پیش‌فاکتور وارد نشده است");
  if (!data.meta.number.trim()) errors.push("شماره پیش‌فاکتور وارد نشده است");
  if (!data.buyer.name.trim()) errors.push("نام خریدار وارد نشده است");
  if (!data.items.some((item) => !rowIsBlank(item))) errors.push("حداقل یک قلم کالا یا خدمت وارد کنید");
  if (data.meta.validityMode === "manual" && !data.meta.validity.trim()) {
    errors.push("تاریخ اعتبار پیش‌فاکتور وارد نشده است");
  }
  return Array.from(new Set(errors));
}
