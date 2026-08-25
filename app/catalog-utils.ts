import { toPersianDigits } from "./site-logic.mjs";

export { toPersianDigits };

export function localizeCatalogValue(value: string | null | undefined) {
  if (!value) return "—";
  // This formats dimensions and spec values (sizes, lengths, weights), never
  // money -- money goes through formatCatalogNumber. Grouping must stay off
  // here, or "1250" (a length in mm) becomes "۱٬۲۵۰".
  return toPersianDigits(value);
}

/**
 * Persian-formatted number for catalog figures: prices, counts, percentages.
 *
 * Percent change is passed maximumFractionDigits: 2, matching the precision
 * the source publishes. At 0 any move under half a percent renders as "۰٪"
 * next to an up/down arrow, which reads as no change at all.
 */
export function formatCatalogNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("fa-IR", { maximumFractionDigits });
}

/** The source publishes `updatedAt` as Unix seconds, for `<time dateTime>` markup. */
export function unixSecondsToIso(value: number): string {
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
