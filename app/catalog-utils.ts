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
