/*
 * Persian (Jalali) calendar helpers for the pre-invoice builder, ported from
 * the standalone پیش‌فاکتور app's js/app.js.
 */
import { toAsciiDigits, toPersianDigits } from "./site-logic.mjs";

export type ValidityMode = "today" | "tomorrow" | "manual";
export const DEFAULT_VALIDITY_MODE: ValidityMode = "today";
export const VALIDITY_LABEL_TODAY = "پایان روز جاری";

/**
 * Today's date on the Persian calendar, formatted "۱۴۰۳/۰۱/۰۱". Falls back to
 * an empty string (leaving the field blank for manual entry) if this
 * browser/runtime has no Jalali ICU data.
 */
export function todayJalaliString(): string {
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return "";
  }
}

export function tomorrowJalaliString(): string {
  try {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

/** Tri-state read of a تاریخ field's raw digits: "1405/06/01", "1405-06-01", "14050601" all land here. */
export function invoiceDateDigits(value: unknown): string {
  const digits = toAsciiDigits(String(value ?? "")).replace(/[^0-9]/g, "");
  return /^\d{8}$/.test(digits) ? digits : "";
}

function formatJalaliYmd(y: number, m: number, d: number): string {
  const pad2 = (n: number) => (n < 10 ? "0" : "") + n;
  return toPersianDigits(`${y}/${pad2(m)}/${pad2(d)}`);
}

const jalaliGregorianCache = new Map<string, number | null>();
const JALALI_CACHE_LIMIT = 400;

/**
 * Converts a Jalali {y,m,d} to the equivalent Gregorian Date. Seeds a rough
 * Gregorian estimate then defers to the browser's own Intl Jalali calendar to
 * confirm/correct it — searching the ±10 days around the seed for the one
 * whose Persian-calendar formatting matches {y,m,d} exactly.
 */
export function jalaliPartsToGregorianDate(y: number, m: number, d: number): Date | null {
  const cacheKey = `${y}/${m}/${d}`;
  if (jalaliGregorianCache.has(cacheKey)) {
    const hit = jalaliGregorianCache.get(cacheKey)!;
    return hit === null ? null : new Date(hit);
  }
  const monthLenEstimate = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30];
  let dayOfYear = d;
  for (let i = 0; i < m - 1; i += 1) dayOfYear += monthLenEstimate[i];
  const seed = new Date(y + 621, 2, 21);
  seed.setDate(seed.getDate() + dayOfYear - 1);
  let found: Date | null = null;
  try {
    const fmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit" });
    for (let offset = -10; offset <= 10 && !found; offset += 1) {
      const candidate = new Date(seed);
      candidate.setDate(candidate.getDate() + offset);
      const parts = fmt.formatToParts(candidate);
      let py = 0, pm = 0, pd = 0;
      parts.forEach((part) => {
        const n = parseInt(toAsciiDigits(part.value), 10);
        if (part.type === "year") py = n;
        else if (part.type === "month") pm = n;
        else if (part.type === "day") pd = n;
      });
      if (py === y && pm === m && pd === d) found = candidate;
    }
  } catch {
    return null;
  }
  if (jalaliGregorianCache.size >= JALALI_CACHE_LIMIT) jalaliGregorianCache.clear();
  jalaliGregorianCache.set(cacheKey, found === null ? null : found.getTime());
  return found === null ? null : new Date(found);
}

const jalaliCalendarAvailable = (() => {
  try {
    const today = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return !!invoiceDateDigits(today);
  } catch {
    return false;
  }
})();

export type InvoiceDateReading =
  | { kind: "empty"; parts: null }
  | { kind: "invalid"; parts: null }
  | { kind: "valid"; parts: { y: number; m: number; d: number } };

/**
 * "invalid" deliberately covers calendar impossibility as well as syntax:
 * ۱۴۰۴/۱۲/۳۰ parses as three numbers, but Esfand has 29 days outside a leap
 * year — confirmed through the browser's own Persian calendar.
 */
export function readInvoiceDate(value: unknown): InvoiceDateReading {
  const text = String(value ?? "").trim();
  if (!text) return { kind: "empty", parts: null };
  const digits = invoiceDateDigits(text);
  const y = digits ? parseInt(digits.slice(0, 4), 10) : 0;
  const m = digits ? parseInt(digits.slice(4, 6), 10) : 0;
  const d = digits ? parseInt(digits.slice(6, 8), 10) : 0;
  const wellFormed = !!digits && !!y && m >= 1 && m <= 12 && d >= 1 && d <= 31;
  if (!jalaliCalendarAvailable) {
    return wellFormed ? { kind: "valid", parts: { y, m, d } } : { kind: "empty", parts: null };
  }
  if (!wellFormed) return { kind: "invalid", parts: null };
  if (!jalaliPartsToGregorianDate(y, m, d)) return { kind: "invalid", parts: null };
  return { kind: "valid", parts: { y, m, d } };
}

/**
 * Resolves a validity mode to the text that belongs in the printed «اعتبار
 * پیش‌فاکتور» field. "manual" resolves to an empty string — the field is left
 * for the user to type into. "today"/"tomorrow" are relative to the تاریخ
 * field's own value (whatever format it was typed in), not the real-world
 * date.
 */
export function resolveValidityValue(mode: ValidityMode, dateFieldValue: string): string {
  if (mode === "manual") return "";
  const read = readInvoiceDate(dateFieldValue);
  // An impossible or garbled تاریخ has no "end of day" and no "next day".
  if (read.kind === "invalid") return "";
  const reference = read.parts;
  if (mode === "tomorrow") {
    if (reference) {
      const greg = jalaliPartsToGregorianDate(reference.y, reference.m, reference.d);
      if (greg) {
        try {
          const next = new Date(greg);
          next.setDate(next.getDate() + 1);
          const formatted = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(next);
          if (formatted) return formatted;
        } catch {
          // fall through to the blank below
        }
      }
      return "";
    }
    return tomorrowJalaliString();
  }
  if (reference) return formatJalaliYmd(reference.y, reference.m, reference.d);
  return todayJalaliString() || VALIDITY_LABEL_TODAY;
}
