export function toPersianDigits(
  value: string | number | null | undefined,
): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 1728),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 144),
    );
}

export function localizeCatalogValue(value: string | null | undefined) {
  if (!value) return "—";
  // This formats dimensions and spec values (sizes, lengths, weights), never
  // money -- prices go through RebarPrices.tsx's own formatNumber. Grouping
  // must stay off here, or "1250" (a length in mm) becomes "۱٬۲۵۰".
  return toPersianDigits(value);
}

/** The source publishes `updatedAt` as Unix seconds, for `<time dateTime>` markup. */
export function unixSecondsToIso(value: number): string {
  return new Date(value * 1000).toISOString();
}

