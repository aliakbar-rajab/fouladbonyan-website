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
};

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
          availableUnits: evaluator.supportsPieceUnits(item.product)
            ? [...quoteUnits]
            : quoteUnits.filter(
                (unit) => unit !== "شاخه" && unit !== "عدد",
              ),
        })),
      };
    },
  };
}
