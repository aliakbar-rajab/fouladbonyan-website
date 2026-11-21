import { parsePersianNumber, toAsciiDigits } from "./persian-numbers.mjs";
import { normalizeCatalogTrend } from "./catalog-trend.mjs";

const DIMENSION_PAIR_PATTERN = /(\d+(?:[.,/٫]\d+)?)\s*[*×xX]\s*(\d+(?:[.,/٫]\d+)?)/;

/**
 * Compute wall thickness `(OD - ID) / 2` in mm from a thick-wall pipe dimension
 * such as `"83*43"` or `"140×80"`.
 */
export function deriveWallThicknessFromSize(size) {
  const ascii = toAsciiDigits(String(size ?? "")).replace(/[/٫]/g, ".");
  const match = ascii.match(DIMENSION_PAIR_PATTERN);
  if (!match) return "";
  const od = Number(match[1]);
  const id = Number(match[2]);
  if (!Number.isFinite(od) || !Number.isFinite(id) || od <= id || id <= 0) {
    return "";
  }
  const wall = (od - id) / 2;
  return String(Number(wall.toFixed(2)));
}

/**
 * Parse a size string into a numeric tuple for natural ascending ordering.
 * Handles mixed fractions (`"1,1/2"` -> `[1.5]`), dimension pairs (`"83*43"` -> `[83, 43]`),
 * prefixed sizes (`"عرض 50"` -> `[50]`), and symbolic widths (`"طول*2"` -> `[Infinity, 2]`).
 */
export function parseNumericSizeParts(value) {
  const ascii = toAsciiDigits(String(value ?? "")).trim();
  if (!ascii) return [];

  const mixedFraction = ascii.match(/^(\d+)\s*,\s*(\d+)\s*\/\s*(\d+)$/);
  if (mixedFraction) {
    const whole = Number(mixedFraction[1]);
    const num = Number(mixedFraction[2]);
    const den = Number(mixedFraction[3]);
    if (den > 0) return [whole + num / den];
  }

  if (/[*×xX]/.test(ascii)) {
    return ascii.split(/[*×xX]/).map((segment) => {
      const parsed = parsePersianNumber(segment);
      if (parsed !== null) return parsed;
      const embedded = segment.match(/\d+(?:[.,/٫]\d+)?/);
      return embedded ? (parsePersianNumber(embedded[0]) ?? Infinity) : Infinity;
    });
  }

  const direct = parsePersianNumber(ascii);
  if (direct !== null) return [direct];

  const embedded = ascii.match(/\d+(?:[.,/٫]\d+)?/g);
  if (embedded?.length) {
    return embedded.map((token) => parsePersianNumber(token) ?? Infinity);
  }
  return [];
}

/** Numeric comparison across parsed size tuples, falling back to Persian collation. */
export function compareNumericSizeValues(first, second) {
  const aParts = parseNumericSizeParts(first);
  const bParts = parseNumericSizeParts(second);
  const shared = Math.max(aParts.length, bParts.length);

  if (aParts.length && bParts.length) {
    for (let index = 0; index < shared; index += 1) {
      const aVal = aParts[index] ?? Infinity;
      const bVal = bParts[index] ?? Infinity;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  }
  if (aParts.length) return -1;
  if (bParts.length) return 1;
  return String(first ?? "").localeCompare(String(second ?? ""), "fa");
}

function numericSpecificationValue(row) {
  const raw = row.specification || "";
  const parsed = parsePersianNumber(raw);
  return parsed !== null ? parsed : Infinity;
}

/**
 * Deterministic numeric row ordering inside each factory card:
 * - Sheet categories (except steel-strip) order primarily by thickness then dimension.
 * - H-beams group by standard (`HEA` before `HEB`) then size.
 * - All other catalogs order primarily by numeric size then specification.
 */
export function sortFactoryRows(rows, { groupId, categoryId } = {}) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row;
      const b = right.row;
      let diff;

      if (groupId === "sheet" && categoryId !== "steel-strip") {
        diff = numericSpecificationValue(a) - numericSpecificationValue(b);
        if (!diff) diff = compareNumericSizeValues(a.size, b.size);
      } else if (categoryId === "hash") {
        diff = String(a.standard ?? "").localeCompare(
          String(b.standard ?? ""),
          "en",
        );
        if (!diff) diff = compareNumericSizeValues(a.size, b.size);
      } else {
        diff = compareNumericSizeValues(a.size, b.size);
        if (!diff) {
          diff = numericSpecificationValue(a) - numericSpecificationValue(b);
        }
      }

      return diff || left.index - right.index;
    })
    .map((entry) => entry.row);
}

const STANDARD_SPEC_LABEL_CATEGORIES = new Set([
  "ribbed",
  "simple",
  "beam",
  "hash",
]);

export function effectiveSpecificationLabel(category) {
  if (!category) return "استاندارد";
  if (category.id === "thick-wall-pipe") {
    return "ضخامت جداره (میلی‌متر)";
  }
  if (
    STANDARD_SPEC_LABEL_CATEGORIES.has(category.id) &&
    (!category.specificationLabel || category.specificationLabel === "ضخامت")
  ) {
    return "استاندارد / گرید";
  }
  return category.specificationLabel || "استاندارد";
}

export function effectiveRowSpecification(row, categoryId) {
  const explicit = row.specification || row.standard || row.grade || "";
  if (explicit) return explicit;
  if (categoryId === "thick-wall-pipe") {
    return deriveWallThicknessFromSize(row.size);
  }
  return "";
}

export function calculateRebarWeight(diameter, length, quantity) {
  const parsedDiameter = parsePersianNumber(diameter);
  const parsedLength = parsePersianNumber(length);
  const parsedQuantity = parsePersianNumber(quantity);
  if (
    parsedDiameter === null ||
    parsedLength === null ||
    parsedQuantity === null ||
    !Number.isInteger(parsedQuantity) ||
    parsedDiameter <= 0 ||
    parsedLength <= 0 ||
    parsedQuantity <= 0
  ) {
    return null;
  }
  return ((parsedDiameter ** 2) / 162) * parsedLength * parsedQuantity;
}

export function getTrendPresentation(status, percent) {
  const trend = normalizeCatalogTrend(status, percent);
  if (trend.status === "unverified") {
    return { direction: "نیازمند بررسی", symbol: "!", amount: 0 };
  }
  if (trend.status === "mixed") {
    return { direction: "نوسان ترکیبی", symbol: "↕", amount: 0 };
  }
  const amount = Math.abs(trend.percent);
  if (amount === 0) {
    return { direction: "بدون تغییر", symbol: "—", amount: 0 };
  }
  if (trend.status === "up") {
    return { direction: "افزایش", symbol: "↑", amount };
  }
  if (trend.status === "down") {
    return { direction: "کاهش", symbol: "↓", amount };
  }
  return { direction: "بدون تغییر", symbol: "—", amount: 0 };
}
