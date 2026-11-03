import { toAsciiDigits, toPersianDigits } from "../persian-numbers.mjs";

/*
 * «شماره پیش‌فاکتور» in the standalone invoice app's own format: the issue
 * date's eight digits, a dash, and that day's sequence padded to three
 * (۱۴۰۵۰۸۱۲-۰۰۱). The app keeps its sequence per company in localStorage;
 * the website has no server to keep one for it, so the sequence here is this
 * browser's own -- a reference for the visitor's conversation with the sales
 * desk, not a registered document number.
 */
const STORAGE_KEY = "fouladbonyan.quoteNumber.v1";

type CounterRecord = { day: string; n: number };

function readCounter(): CounterRecord | null {
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as CounterRecord).day === "string" &&
      typeof (parsed as CounterRecord).n === "number"
    ) {
      return parsed as CounterRecord;
    }
  } catch {
    // Unavailable or corrupt storage just restarts the day's sequence.
  }
  return null;
}

/** Takes the next number for `date` (a Persian `YYYY/MM/DD`) and records it. */
export function takeQuoteNumber(date: string): string {
  const day = toAsciiDigits(date).replace(/\D/g, "");
  if (day.length !== 8) return "";
  const previous = readCounter();
  const n = previous?.day === day ? previous.n + 1 : 1;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ day, n }));
  } catch {
    // Private mode: the number is still valid, it just won't advance.
  }
  return toPersianDigits(`${day}-${String(n).padStart(3, "0")}`);
}
