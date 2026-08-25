/*
 * BigInt-based money/quantity/percent parsing and formatting for the
 * pre-invoice builder, ported from the standalone پیش‌فاکتور app's
 * js/persian-numbers.js.
 *
 * Rial amounts routinely exceed Number.MAX_SAFE_INTEGER in real invoices, and
 * once a value crosses that line ordinary float math silently rounds it — the
 * BigInt path keeps parsing, formatting, arithmetic and word-conversion exact
 * regardless of magnitude.
 */
import { toAsciiDigits, toPersianDigits } from "./site-logic.mjs";

export { toAsciiDigits, toPersianDigits };

const GROUP_SEP = "٬"; // Arabic thousands separator (matches fa-IR grouping)
const DECIMAL_SEP = "٫"; // Arabic decimal separator (matches fa-IR decimal point)

/**
 * Normalizes a user-typed numeric string to ASCII digits with a plain "."
 * decimal point and no grouping separators. Handles both punctuation
 * conventions the app itself ever produces (ASCII "," / Persian "٬" for
 * grouping, ASCII "." / Persian "٫" for the decimal point) as well as raw
 * keyboard input.
 */
function normalizeNumericInput(value: unknown): string {
  if (value === null || value === undefined) return "";
  return toAsciiDigits(String(value))
    .replace(/[,\s٬]/g, "")
    .replace(/٫/g, ".");
}

/**
 * Parses a numeric string into a BigInt scaled by 10^decimals (e.g.
 * decimals=3 turns "2.755" into 2755n), rounding half-up on any digits beyond
 * that precision.
 */
function parseDecimalToBigIntScaled(value: unknown, decimals: number): bigint {
  const normalized = normalizeNumericInput(value).replace(/[^0-9.-]/g, "");
  const match = normalized.match(/^(-?)(\d*)(?:\.(\d*))?$/);
  if (!match) return 0n;

  const sign = match[1] === "-" ? -1n : 1n;
  const intDigits = match[2] || "0";
  const fracDigits = match[3] || "";

  const extended = (fracDigits + "0".repeat(decimals + 1)).slice(0, decimals + 1);
  const keep = extended.slice(0, decimals);
  const roundDigit = extended.charAt(decimals);

  let scaled: bigint;
  try {
    scaled = BigInt(intDigits + keep);
  } catch {
    return 0n;
  }
  if (roundDigit >= "5") scaled += 1n;
  return sign * scaled;
}

/** Rounds numerator/denominator to the nearest integer (half-up), entirely in BigInt arithmetic. */
export function bigRoundDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) return 0n;
  const negResult = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const result = (2n * n + d) / (2n * d);
  return negResult ? -result : result;
}

/** Groups an ASCII digit string into 3s from the right with `sep`. */
function groupDigits(digitsAscii: string, sep: string): string {
  let out = "";
  let count = 0;
  for (let i = digitsAscii.length - 1; i >= 0; i -= 1) {
    out = digitsAscii.charAt(i) + out;
    count += 1;
    if (count % 3 === 0 && i !== 0) out = sep + out;
  }
  return out;
}

// ---------- Money (integer Rial, no fractional subunit) ----------

export function parseMoneyBig(value: unknown): bigint {
  return parseDecimalToBigIntScaled(value, 0);
}

export function formatBigRial(value: bigint | null | undefined): string {
  const v = value ?? 0n;
  const neg = v < 0n;
  const digits = (neg ? -v : v).toString();
  return (neg ? "-" : "") + toPersianDigits(groupDigits(digits, GROUP_SEP));
}

// ---------- Quantity (up to 3 decimal places) ----------

export function parseQtyMilli(value: unknown): bigint {
  return parseDecimalToBigIntScaled(value, 3);
}

export function formatQtyMilli(value: bigint | null | undefined): string {
  const v = value ?? 0n;
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const intPart = abs / 1000n;
  const fracPart = abs % 1000n;
  let out = groupDigits(intPart.toString(), GROUP_SEP);
  if (fracPart !== 0n) {
    let fracStr = fracPart.toString();
    while (fracStr.length < 3) fracStr = "0" + fracStr;
    fracStr = fracStr.replace(/0+$/, "");
    out += DECIMAL_SEP + fracStr;
  }
  return (neg ? "-" : "") + toPersianDigits(out);
}

// ---------- Percent (up to 2 decimal places, stored as basis points) ----------

export function parsePercentBps(value: unknown): bigint {
  return parseDecimalToBigIntScaled(value, 2);
}

export function formatPercentBps(value: bigint | null | undefined): string {
  const v = value ?? 0n;
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const intPart = abs / 100n;
  const fracPart = abs % 100n;
  let out = intPart.toString();
  if (fracPart !== 0n) {
    let fracStr = fracPart.toString();
    while (fracStr.length < 2) fracStr = "0" + fracStr;
    fracStr = fracStr.replace(/0+$/, "");
    out += DECIMAL_SEP + fracStr;
  }
  return (neg ? "-" : "") + toPersianDigits(out);
}

// ---------- Strict field validation ----------
// An integer part is either bare digits, or 1-3 digits followed by complete
// 3-digit groups joined by ONE consistent separator.
const STRICT_UNGROUPED_INT = /^\d+$/;
const STRICT_GROUPED_INT = /^\d{1,3}(?:([,٬\s])\d{3})(?:\1\d{3})*$/;

export type StrictNumberResult = {
  valid: boolean;
  calculable: boolean;
  value: bigint;
};

/**
 * Normalizes a user-typed numeric string to plain ASCII digits with a "."
 * decimal point, or returns null when the text is not a well-formed number.
 * "" means genuinely empty; null means malformed.
 */
function normalizeStrictNumber(value: unknown): string | null {
  let raw = toAsciiDigits(String(value ?? "")).trim().replace(/٫/g, ".");
  if (!raw) return "";
  let sign = "";
  if (raw.charAt(0) === "-") {
    sign = "-";
    raw = raw.slice(1);
  }
  const pieces = raw.split(".");
  if (pieces.length > 2) return null;
  const intPart = pieces[0];
  const fracPart = pieces.length > 1 ? pieces[1] : null;
  if (!STRICT_UNGROUPED_INT.test(intPart) && !STRICT_GROUPED_INT.test(intPart)) return null;
  if (fracPart !== null && !/^\d*$/.test(fracPart)) return null;
  return sign + intPart.replace(/[,٬\s]/g, "") + (fracPart === null ? "" : "." + fracPart);
}

export function strictMoney(value: unknown, emptyAsZero: boolean): StrictNumberResult {
  const normalized = normalizeStrictNumber(value);
  if (normalized === null) return { valid: false, calculable: false, value: 0n };
  if (!normalized && emptyAsZero) return { valid: true, calculable: true, value: 0n };
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { valid: false, calculable: false, value: 0n };
  return {
    valid: /^\d+$/.test(normalized),
    calculable: true,
    value: parseMoneyBig(normalized),
  };
}

export function strictQuantity(value: unknown): StrictNumberResult {
  const normalized = normalizeStrictNumber(value);
  if (normalized === null) return { valid: false, calculable: false, value: 0n };
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { valid: false, calculable: false, value: 0n };
  const parsed = parseQtyMilli(normalized);
  return {
    valid: /^\d+(?:\.\d{1,3})?$/.test(normalized) && parsed > 0n,
    calculable: true,
    value: parsed,
  };
}

export function strictPercent(value: unknown): StrictNumberResult {
  const normalized = normalizeStrictNumber(value);
  if (normalized === null) return { valid: false, calculable: false, value: 0n };
  if (!normalized) return { valid: true, calculable: true, value: 0n };
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return { valid: false, calculable: false, value: 0n };
  const parsed = parsePercentBps(normalized);
  return {
    valid: /^\d+(?:\.\d{1,2})?$/.test(normalized) && parsed >= 0n && parsed <= 10000n,
    calculable: true,
    value: parsed,
  };
}

// ---------- Amount in words ----------

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه",
  "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده",
  "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];

function threeDigitsToWords(value: number): string {
  const parts: string[] = [];
  if (value >= 100) parts.push(HUNDREDS[Math.floor(value / 100)]);
  const remainder = value % 100;
  if (remainder < 20) {
    if (remainder) parts.push(ONES[remainder]);
  } else {
    parts.push(TENS[Math.floor(remainder / 10)]);
    if (remainder % 10) parts.push(ONES[remainder % 10]);
  }
  return parts.join(" و ");
}

/**
 * Formal Persian financial wording only ever combines «هزار»/«میلیون»/«میلیارد»
 * — never an imported term like «تریلیون». Beyond «میلیارد» (10^9), larger
 * magnitudes are expressed compositionally the way Iranian financial
 * documents already do (e.g. «هزار میلیارد» for 10^12).
 */
function scaleWordForGroup(groupIndex: number): string {
  if (groupIndex === 0) return "";
  const exponent = groupIndex * 3;
  const billionRepeats = Math.floor(exponent / 9);
  const remainder = exponent % 9;
  const prefix = remainder === 3 ? "هزار" : remainder === 6 ? "میلیون" : "";
  const words: string[] = [];
  if (prefix) words.push(prefix);
  for (let i = 0; i < billionRepeats; i += 1) words.push("میلیارد");
  return words.join(" ");
}

export function rialToWordsBig(value: bigint | null | undefined): string {
  const v = value ?? 0n;
  if (v === 0n) return "صفر ریال";

  const neg = v < 0n;
  let remaining = neg ? -v : v;
  const groups: string[] = [];
  let groupIndex = 0;

  while (remaining > 0n) {
    const group = Number(remaining % 1000n); // always 0-999: exact as a plain Number
    if (group) {
      const scaleWord = scaleWordForGroup(groupIndex);
      groups.unshift(threeDigitsToWords(group) + (scaleWord ? " " + scaleWord : ""));
    }
    remaining = remaining / 1000n;
    groupIndex += 1;
  }

  return (neg ? "منفی " : "") + groups.join(" و ") + " ریال";
}
