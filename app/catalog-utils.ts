import {
  formatPersianNumber,
  toPersianDigits,
} from "./persian-numbers.mjs";

export const formatCatalogNumber = formatPersianNumber;

export function localizeCatalogValue(value: string | null | undefined) {
  if (!value) return "—";
  // This formats dimensions and spec values (sizes, lengths, weights), never
  // money -- money goes through formatCatalogNumber. Grouping must stay off
  // here, or "1250" (a length in mm) becomes "۱٬۲۵۰".
  return toPersianDigits(value);
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

export function displayPrice(
  price: number | null,
  taxIncluded: boolean,
  taxRate: number,
) {
  if (!price) return "تماس بگیرید";
  const adjustedPrice = taxIncluded
    ? Math.round((price * (1 + taxRate)) / 100) * 100
    : price;
  return formatCatalogNumber(adjustedPrice);
}

/**
 * Index an arrow/Home/End key should move focus to inside a tablist, or null
 * when the key is not a tablist key.
 *
 * ArrowLeft advances and ArrowRight retreats: the tabs are laid out
 * right-to-left, so "left" is forward on screen.
 */
export function nextRovingIndex(
  key: string,
  currentIndex: number,
  count: number,
): number | null {
  if (!count) return null;
  if (key === "ArrowLeft") return (currentIndex + 1) % count;
  if (key === "ArrowRight") return (currentIndex - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
