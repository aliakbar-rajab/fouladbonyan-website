/**
 * The single home of how a catalog value reaches the page.
 *
 * Everything the reader sees about a price is decided here: whether the price
 * exists at all, what a `Price unavailable` row reads instead, whether VAT is
 * folded in, how the digits are grouped, and whether a Sales unit is shown
 * beside the amount.
 *
 * It exists because those decisions used to be made separately. The canonical
 * predicate lived in catalog-pricing.mjs and no renderer called it; the price
 * cell decided three times over whether a row was priced -- once for the text
 * (`!price`), once for the colour (`row.price ?`) and once for the unit suffix
 * (`row.price ?`) -- and two overview shells re-decided it a fourth and fifth
 * time against a different value. Four of the five tests were one token long,
 * which is why they were written inline, and why they could drift apart
 * without anything noticing.
 *
 * The rule now has an interface, so it has somewhere to be tested. Callers
 * still choose their own markup; they no longer choose the rule.
 */
import { isPricedRow } from "./catalog-pricing.mjs";
import { normalizeCatalogTrend } from "./catalog-trend.mjs";
import {
  formatPersianNumber,
  toAsciiDigits,
  toPersianDigits,
} from "./persian-numbers.mjs";

/** CONTEXT.md `Price unavailable`: what a row with no upstream price reads. */
export const PRICE_UNAVAILABLE_TEXT = "تماس بگیرید";

/**
 * What a price reads before its snapshot has arrived. Distinct from
 * `Price unavailable`: nothing is yet known either way, so promising the
 * reader a phone call would be premature.
 */
export const PRICE_PENDING_TEXT = "در حال به‌روزرسانی…";

/** The currency every catalog price is quoted in (CONTEXT.md, toman). */
const CURRENCY = "تومان";

export type PricePresentationOptions = {
  /**
   * The row's Sales unit. When given and the price is available, it joins the
   * currency in the suffix -- a price is meaningful only with its unit.
   */
  unit?: string | null;
  /** Whether the reader has asked for VAT-inclusive figures. */
  taxIncluded?: boolean;
  /** The snapshot's VAT rate, used only when `taxIncluded`. */
  taxRate?: number;
};

export type PresentedPrice = {
  /**
   * Whether this carries a real price. False is exactly CONTEXT.md's
   * `Price unavailable`, and is the one predicate the page is allowed to ask.
   */
  available: boolean;
  /** The amount as it reads on the page, or the `Price unavailable` sentinel. */
  text: string;
  /**
   * Currency, and the Sales unit when one was given -- null when there is no
   * price, because an unavailable row must not show a price unit.
   */
  suffix: string | null;
};

const UNAVAILABLE: PresentedPrice = {
  available: false,
  text: PRICE_UNAVAILABLE_TEXT,
  suffix: null,
};

/** Rounds a VAT-inclusive figure to the nearest hundred toman and removes sub-toman fractions. */
function withTax(price: number, taxIncluded: boolean, taxRate: number) {
  return taxIncluded
    ? Math.round((price * (1 + taxRate)) / 100) * 100
    : Math.round(price);
}

function suffixFor(unit: string | null | undefined) {
  return unit ? `${CURRENCY} / ${unit}` : CURRENCY;
}

/**
 * One price, as the page shows it.
 *
 * @param price the row's price, or null for `Price unavailable`
 */
export function presentPrice(
  price: number | null | undefined,
  { unit, taxIncluded = false, taxRate = 0 }: PricePresentationOptions = {},
): PresentedPrice {
  if (!isPricedRow({ price: price ?? null })) return UNAVAILABLE;
  return {
    available: true,
    text: formatPersianNumber(withTax(price as number, taxIncluded, taxRate)),
    suffix: suffixFor(unit),
  };
}

/**
 * A min/max range, as the page shows it.
 *
 * A range is available only when both ends are real prices; whether a
 * particular category is *allowed* a range at all stays with
 * `categoryPricing` in catalog-pricing.mjs, which is a question about
 * Sales units rather than about presentation.
 */
export function presentPriceRange(
  range: { min: number; max: number } | null | undefined,
  { unit, taxIncluded = false, taxRate = 0 }: PricePresentationOptions = {},
): PresentedPrice {
  const min = presentPrice(range?.min, { taxIncluded, taxRate });
  const max = presentPrice(range?.max, { taxIncluded, taxRate });
  if (!min.available || !max.available) return UNAVAILABLE;
  return {
    available: true,
    text: `${min.text} تا ${max.text}`,
    suffix: suffixFor(unit),
  };
}

/**
 * A dimension or specification value, as the page shows it.
 *
 * Sizes, lengths and weights -- never money, which goes through
 * `presentPrice`. Digit grouping must stay off here, or "1250" (a length in
 * mm) becomes "۱٬۲۵۰".
 */
export function localizeCatalogValue(value: string | null | undefined) {
  if (!value) return "—";
  return toPersianDigits(value);
}

const PERSIAN_LETTERS_PATTERN = /[\u0621-\u064A\u067E\u0686\u0698\u06AF\u06A9\u06CC]/;

/**
 * Human-readable catalog dimension formatting:
 * - Converts `"1,1/2"` scaffold pipe nominal sizing into `"۱٫۵ اینچ (نمره ۵)"`.
 * - Replaces `*` with `×` and flags pure numeric/Latin dimension pairs (`83 × 43`)
 *   for `<bdi dir="ltr">` so BIDI ordering never flips OD and ID.
 */
export function formatCatalogSize(
  size: string | null | undefined,
  categoryId?: string,
): { text: string; ltr: boolean } {
  if (!size) return { text: "—", ltr: false };
  const trimmed = size.trim();
  if (!trimmed) return { text: "—", ltr: false };

  if (
    categoryId === "scaffold-pipe" &&
    /^\s*1\s*[,/]\s*1\/2\s*$/.test(toAsciiDigits(trimmed))
  ) {
    return { text: "۱٫۵ اینچ (نمره ۵)", ltr: false };
  }

  if (/[*×]/.test(trimmed)) {
    const normalized = toPersianDigits(trimmed.replace(/\s*[*×]\s*/g, " × "));
    return {
      text: normalized,
      ltr: !PERSIAN_LETTERS_PATTERN.test(trimmed),
    };
  }

  return { text: toPersianDigits(trimmed), ltr: false };
}

/**
 * The source publishes `updatedAt` as Unix seconds, for `<time dateTime>`
 * markup. A row the source never dated carries 0, which is a real instant
 * (1970-01-01) rather than a missing one -- publishing that as the machine
 * reading beside a visible "—" states a date nobody claimed, so an undated row
 * gets no `dateTime` at all.
 */
export function unixSecondsToIso(value: number): string | undefined {
  if (!value || !Number.isFinite(value)) return undefined;
  return new Date(value * 1000).toISOString();
}

export type PriceMovementStatus =
  | "up"
  | "down"
  | "same"
  | "unverified"
  | "mixed";

export type PresentedPriceMovement = {
  /** Normalized movement status after sanity checks. */
  status: PriceMovementStatus;
  /** CSS modifier matching the normalized status (`is-up`, `is-down`, ...). */
  toneClass: `is-${PriceMovementStatus}`;
  /** Human-readable Persian direction label. */
  direction: string;
  /** Formatted Persian percentage magnitude with `٪`, or null when inapplicable. */
  percentText: string | null;
  /** Complete formatted label (`"افزایش ۰٫۱۴٪"`, or `direction` without percent). */
  text: string;
};

const MOVEMENT_DIRECTIONS: Record<PriceMovementStatus, string> = {
  up: "افزایش",
  down: "کاهش",
  same: "بدون تغییر",
  unverified: "نیازمند بررسی",
  mixed: "نوسان ترکیبی",
};

/**
 * Price movement, as the page shows and styles it.
 *
 * Normalizes upstream status and percentage in one place so every caller pairs
 * the same formatted text with the CSS tone of the normalized status.
 */
export function presentPriceMovement(
  status: string | null | undefined,
  percent: number | null | undefined,
): PresentedPriceMovement {
  const normalized = normalizeCatalogTrend(status, percent);
  const normalizedStatus = normalized.status as PriceMovementStatus;
  const direction = MOVEMENT_DIRECTIONS[normalizedStatus];
  const amount = Math.abs(normalized.percent);
  const percentText =
    (normalizedStatus === "up" || normalizedStatus === "down") && amount > 0
      ? `${formatPersianNumber(amount, 2)}٪`
      : null;

  return {
    status: normalizedStatus,
    toneClass: `is-${normalizedStatus}`,
    direction,
    percentText,
    text: percentText ? `${direction} ${percentText}` : direction,
  };
}
