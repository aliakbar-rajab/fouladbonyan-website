/**
 * Canonical Persian and Arabic numeral normalization, localized parsing, and formatting.
 *
 * Pure ESM module usable in both browser and plain Node runtimes without dependencies.
 */

/**
 * Convert Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII digits (0-9).
 * Both blocks (U+06F0 and U+0660) run 0-9 in order, so the digit's value is the low nibble.
 * Preserves all other characters. Returns an empty string for null or undefined.
 *
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function toAsciiDigits(value = "") {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) & 0xf),
  );
}

/**
 * Convert ASCII (0-9) and Arabic-Indic (٠-٩) digits to Persian digits (۰-۹).
 * Both target blocks run 0-9 in order, so each digit is a fixed offset from its source.
 * Preserves all other characters. Returns an empty string for null or undefined.
 *
 * @param {string | number | null | undefined} value
 * @returns {string}
 */
export function toPersianDigits(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 1728),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 144),
    );
}

/**
 * Parse a localized Persian, Arabic, or Latin numeric string into a JavaScript number.
 *
 * Handles:
 * - Persian digits (۰-۹), Arabic digits (٠-٩), and Latin digits (0-9)
 * - Slash decimals ('/'), Arabic decimal separator ('٫'), and standard dot ('.')
 * - Persian thousands separator ('٬') and standard comma (',')
 * - Leading/trailing whitespace
 *
 * Returns null for empty, missing, invalid, or non-finite inputs.
 *
 * @param {string | number | null | undefined} value
 * @returns {number | null}
 */
export function parsePersianNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const str = String(value).trim();
  if (!str || str === "-") return null;

  const normalized = toAsciiDigits(str)
    .replace(/[/٫]/g, ".")
    .replace(/[,٬]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Format a number using Persian numerals and localized grouping.
 *
 * @param {number} value
 * @param {number} [maximumFractionDigits=0]
 * @returns {string}
 */
export function formatPersianNumber(value, maximumFractionDigits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return value.toLocaleString("fa-IR", { maximumFractionDigits });
}

const ones = [
  "", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه",
  "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده",
  "هفده", "هجده", "نوزده",
];
const tens = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const hundreds = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const scales = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function threeDigitsToWords(value) {
  const parts = [];
  if (value >= 100) parts.push(hundreds[Math.floor(value / 100)]);
  const remainder = value % 100;
  if (remainder < 20) {
    if (remainder) parts.push(ones[remainder]);
  } else {
    parts.push(tens[Math.floor(remainder / 10)]);
    if (remainder % 10) parts.push(ones[remainder % 10]);
  }
  return parts.join(" و ");
}

/**
 * Convert a numeric Rial amount to its Persian text representation in words.
 *
 * @param {number} value
 * @returns {string}
 */
export function rialToWords(value) {
  if (!value || value <= 0 || !Number.isFinite(value)) return "صفر ریال";
  const groups = [];
  let remaining = Math.round(value);
  let scaleIndex = 0;

  while (remaining > 0 && scaleIndex < scales.length) {
    const group = remaining % 1000;
    if (group) {
      groups.unshift(
        `${threeDigitsToWords(group)}${scales[scaleIndex] ? ` ${scales[scaleIndex]}` : ""}`,
      );
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  return `${groups.join(" و ")} ریال`;
}
