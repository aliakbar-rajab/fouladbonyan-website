import { isPieceUnit } from "./quote/calculation";
import {
  createQuoteEvaluator,
  type QuoteEvaluator,
} from "./quote/evaluator";
import {
  quoteUnits,
  type QuoteItemEvaluation,
  type QuotePieceOptionChoice,
  type QuoteTotals,
  type QuoteUnit,
  type RawQuoteItem,
} from "./quote-types";

export type QuoteItemEstimate = QuoteItemEvaluation & {
  pieceOptions: QuotePieceOptionChoice[];
  availableUnits: QuoteUnit[];
  isPieceUnit: boolean;
  unitPriceTomanPerKg: number | null;
};

export type QuoteItemsEstimate = {
  items: QuoteItemEstimate[];
  totals: QuoteTotals;
};

export type QuoteRequestEstimate = {
  estimateItems: (items: RawQuoteItem[]) => QuoteItemsEstimate;
  /**
   * Apply one edit to a raw item, reconciling the fields that pricing couples
   * together. The form patches items through this rather than merging them
   * itself, so which products can be sold by the piece stays a pricing
   * question.
   */
  applyItemChange: (
    item: RawQuoteItem,
    patch: Partial<RawQuoteItem>,
  ) => RawQuoteItem;
};

/**
 * The unit list the form offers, with the unit the item actually carries kept
 * in it. The list narrows once prices load and the product turns out not to be
 * sellable by the piece; without this the narrowing could strand an already
 * chosen شاخه outside its own <select>, which would then display some other
 * unit than the one being priced and validated.
 */
function withSelectedUnit(
  units: QuoteUnit[],
  selected: QuoteUnit,
): QuoteUnit[] {
  return units.includes(selected) ? units : [...units, selected];
}

/**
 * Presentation-ready item estimates consumed by the quote form. Pricing
 * baselines stay inside QuoteEvaluator; validation and request evaluation are
 * used directly from the quote modules.
 */
export function createQuoteRequestEstimate(
  evaluator: QuoteEvaluator = createQuoteEvaluator(),
): QuoteRequestEstimate {
  return {
    estimateItems(items) {
      const evaluation = evaluator.evaluateItems(items);
      return {
        totals: evaluation.totals,
        items: evaluation.items.map((item) => ({
          ...item,
          pieceOptions: evaluator.getPieceOptions(item.product),
          isPieceUnit: item.unit === "شاخه" || item.unit === "عدد",
          unitPriceTomanPerKg:
            item.weightInKg && item.approximateTotalToman !== null
              ? Math.round(item.approximateTotalToman / item.weightInKg)
              : null,
          availableUnits: withSelectedUnit(
            evaluator.supportsPieceUnits(item.product)
              ? [...quoteUnits]
              : quoteUnits.filter((unit) => unit !== "شاخه" && unit !== "عدد"),
            item.unit,
          ),
        })),
      };
    },

    applyItemChange(item, patch) {
      const patched = { ...item, ...patch };
      /*
       * A product that cannot be priced by the piece drops شاخه/عدد from its
       * unit list. Carrying the old piece unit across the product change left
       * the form's <select> showing a unit it no longer offered while the item
       * stayed priced -- and rejected on submit -- as شاخه, with no way back
       * to it, so the unit falls back together with the product.
       */
      if (
        "product" in patch &&
        isPieceUnit(patched.unit) &&
        !evaluator.supportsPieceUnits(patched.product)
      ) {
        return { ...patched, unit: "تن" };
      }
      return patched;
    },
  };
}
