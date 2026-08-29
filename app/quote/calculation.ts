import { calculateRebarWeight } from "../catalog-behavior.mjs";
import { formatCatalogNumber } from "../catalog-utils";
import { parsePersianNumber } from "../persian-numbers.mjs";
import type {
  QuoteItemEvaluation,
  QuotePieceOptionChoice,
  QuoteProductName,
  QuoteTotals,
  RawQuoteItem,
} from "../quote-types";
import type {
  ProductPricingBaseline,
  QuotePricingBaselines,
} from "./pricing-source";

export const RIAL_PER_TOMAN = 10;
export const REBAR_STANDARD_BRANCH_LENGTH_M = 12;

export const tomanToRial = (toman: number): number => toman * RIAL_PER_TOMAN;

export const formatToman = (value: number): string =>
  `${formatCatalogNumber(value)} تومان`;

export const isPieceUnit = (unit: string): boolean =>
  unit === "شاخه" || unit === "عدد";

export const itemIndexLabel = (index: number): string =>
  formatCatalogNumber(index + 1);

function resolvePieceOption(
  pieceOptionKey: string,
  baseline: ProductPricingBaseline | undefined,
): QuotePieceOptionChoice | undefined {
  if (!pieceOptionKey || !baseline?.pieceOptions?.length) return undefined;
  return baseline.pieceOptions.find((option) => option.key === pieceOptionKey);
}

function buildPriceExplanation({
  product,
  quantity,
  unit,
  approximateTotalToman,
  baseline,
  pieceOption,
  rebarDiameterMm,
  pieceOptionKey,
}: {
  product: QuoteProductName | "";
  quantity: string;
  unit: string;
  approximateTotalToman: number | null;
  baseline: ProductPricingBaseline | undefined;
  pieceOption: QuotePieceOptionChoice | undefined;
  rebarDiameterMm: string;
  pieceOptionKey: string;
}): string {
  const byPiece = isPieceUnit(unit);

  if (!product) {
    return "پس از انتخاب کالا و واردکردن مقدار، قیمت تقریبی نمایش داده می‌شود.";
  }
  if (!baseline) {
    return "برای این کالا قیمت وزنی قابل محاسبه نیست؛ با واحد فروش تماس بگیرید.";
  }
  if (byPiece && baseline.branchWeight && !rebarDiameterMm) {
    return `برای محاسبه قیمت بر اساس ${unit}، قطر میلگرد (میلی‌متر) را در فیلد بالا وارد کنید.`;
  }
  if (byPiece && (baseline.pieceOptions?.length ?? 0) > 0 && !pieceOptionKey) {
    return "برای محاسبه قیمت، آیتم دقیق را از فهرست قیمت سایت در فیلد بالا انتخاب کنید.";
  }
  if (approximateTotalToman === null || !quantity.trim()) {
    return "برای مشاهده برآورد، مقدار معتبر بزرگ‌تر از صفر وارد کنید.";
  }

  if (pieceOption) {
    return `قیمت واقعی سایت برای ${pieceOption.label}: ${formatToman(pieceOption.priceToman)} برای هر ${pieceOption.unit} | قیمت تقریبی: ${formatToman(approximateTotalToman)}`;
  }

  const weightDetail =
    baseline.branchWeight && byPiece
      ? ` (بر اساس وزن تقریبی هر ${unit} با فرمول استاندارد میلگرد و طول شاخه ${formatCatalogNumber(REBAR_STANDARD_BRANCH_LENGTH_M)} متر)`
      : "";

  return `میانگین داده قیمت سایت: ${formatToman(baseline.unitPriceTomanPerKg)} برای هر کیلوگرم${weightDetail} | قیمت تقریبی: ${formatToman(approximateTotalToman)}`;
}

export function evaluateItemPricing(
  raw: Partial<RawQuoteItem> | null | undefined,
  baselines: QuotePricingBaselines | null | undefined,
): QuoteItemEvaluation {
  const id = raw?.id ?? 1;
  const rawProduct = raw?.product ?? "";
  const product: QuoteProductName | "" = rawProduct;
  const rawQuantity = String(raw?.quantity ?? "").trim();
  const rawDiameter = String(raw?.rebarDiameterMm ?? "").trim();
  const pieceOptionKey = String(raw?.pieceOptionKey ?? "").trim();
  const dimensions = String(raw?.dimensions ?? "").trim();

  const quantityNumeric = parsePersianNumber(rawQuantity);
  const rebarDiameterNumeric = parsePersianNumber(rawDiameter);

  const rawUnit = raw?.unit ?? "تن";
  const unit =
    rawUnit === "کیلوگرم" || rawUnit === "شاخه" || rawUnit === "عدد"
      ? rawUnit
      : "تن";

  const baseline = product && baselines ? baselines[product] : undefined;
  const pieceOption = resolvePieceOption(pieceOptionKey, baseline);
  const effectiveUnit = pieceOption?.unit ?? unit;

  let approximateTotalToman: number | null = null;
  let weightInKg: number | null = null;

  if (baseline && quantityNumeric !== null && quantityNumeric > 0) {
    if (pieceOption) {
      approximateTotalToman = Math.round(
        pieceOption.priceToman * quantityNumeric,
      );
    } else if (unit === "تن" || unit === "کیلوگرم") {
      weightInKg = unit === "تن" ? quantityNumeric * 1_000 : quantityNumeric;
      approximateTotalToman = Math.round(
        baseline.unitPriceTomanPerKg * weightInKg,
      );
    } else if (
      baseline.branchWeight === "rebar-12m" &&
      rebarDiameterNumeric !== null &&
      rebarDiameterNumeric > 0
    ) {
      const calculatedWeight = calculateRebarWeight(
        rebarDiameterNumeric,
        REBAR_STANDARD_BRANCH_LENGTH_M,
        Math.trunc(quantityNumeric),
      );
      if (calculatedWeight) {
        weightInKg = calculatedWeight;
        approximateTotalToman = Math.round(
          baseline.unitPriceTomanPerKg * calculatedWeight,
        );
      }
    }
  }

  const approximateTotalRial =
    approximateTotalToman === null ? null : tomanToRial(approximateTotalToman);

  const unitPriceRial =
    approximateTotalRial === null || !quantityNumeric
      ? null
      : Math.round(approximateTotalRial / quantityNumeric);

  const priceExplanation = buildPriceExplanation({
    product,
    quantity: rawQuantity,
    unit,
    approximateTotalToman,
    baseline,
    pieceOption,
    rebarDiameterMm: rawDiameter,
    pieceOptionKey,
  });

  return {
    id,
    product,
    quantity: rawQuantity,
    quantityNumeric,
    unit,
    effectiveUnit,
    dimensions,
    rebarDiameterMm: rawDiameter,
    rebarDiameterNumeric,
    pieceOptionKey,
    pieceOption,
    approximateTotalToman,
    approximateTotalRial,
    unitPriceRial,
    weightInKg,
    priceExplanation,
    supportsPieceUnits: baseline?.supportsPieceUnits ?? true,
    requiresRebarDiameter: Boolean(baseline?.branchWeight),
  };
}

export function aggregateQuoteTotals(
  items: QuoteItemEvaluation[],
): QuoteTotals {
  let totalToman = 0;
  let totalRial = 0;
  let pricedItemCount = 0;

  for (const item of items) {
    if (item.approximateTotalToman !== null) {
      totalToman += item.approximateTotalToman;
      totalRial += item.approximateTotalRial ?? 0;
      pricedItemCount += 1;
    }
  }

  return {
    totalToman,
    totalRial,
    pricedItemCount,
    totalItemCount: items.length,
    hasAnyPriced: pricedItemCount > 0,
  };
}
