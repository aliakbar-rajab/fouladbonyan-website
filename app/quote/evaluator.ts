import {
  aggregateQuoteTotals,
  evaluateItemPricing,
  isPieceUnit,
} from "./calculation";
import {
  buildQuoteDocument,
  buildQuoteMessage,
} from "./serialization";
import {
  normalizeQuoteContact,
  validateQuoteRequestInput,
} from "./validation";
import type {
  QuoteEvaluationResult,
  QuoteItemEvaluation,
  QuotePieceOptionChoice,
  QuotePricingBaselines,
  QuoteTotals,
  QuoteUnit,
  RawQuoteItem,
  RawQuoteRequest,
} from "../quote-types";
import { quoteProductSupportsPieceUnits, quoteUnits } from "../quote-types";

/**
 * Presentation-ready item estimate consumed by the quote form. Pricing
 * baselines stay inside the evaluator; the form-facing fields are derived
 * here so which products can be sold by the piece stays a pricing question.
 */
export type QuoteItemEstimate = QuoteItemEvaluation & {
  pieceOptions: QuotePieceOptionChoice[];
  availableUnits: QuoteUnit[];
  isPieceUnit: boolean;
  unitPriceTomanPerKg: number | null;
};

/**
 * What the quote form may ask of pricing.
 *
 * Three members, because three is what the form calls. It used to expose
 * seven: `evaluateItem` and `evaluateItems` forwarded straight to
 * calculation.ts, and `getPieceOptions` and `requiresRebarDiameter` answered
 * questions whose answers already travel on the estimate -- so completely that
 * a test had to forbid the form from naming them in order to keep the seam
 * from eroding. All four are still reachable through `estimateItems`, which is
 * the path the form actually takes.
 */
export type QuoteEvaluator = {
  /** Evaluate items into the presentation-ready shape the quote form renders. */
  estimateItems: (
    items: (Partial<RawQuoteItem> | null | undefined)[],
  ) => {
    items: QuoteItemEstimate[];
    totals: QuoteTotals;
  };

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

  /** Validate and evaluate a complete quote request (pricing, validation, message, document). */
  evaluateRequest: (request: RawQuoteRequest) => QuoteEvaluationResult;
};

/**
 * Construct a QuoteEvaluator over already-derived pricing baselines.
 * Catalog translation belongs to pricing-source.
 */
export function createQuoteEvaluator(
  source?: QuotePricingBaselines | null,
): QuoteEvaluator {
  const baselines = source ?? {};

  const evaluateItems = (
    items: (Partial<RawQuoteItem> | null | undefined)[],
  ): { items: QuoteItemEvaluation[]; totals: QuoteTotals } => {
    const evaluatedItems = (items ?? []).map((item) =>
      evaluateItemPricing(item, baselines),
    );
    return {
      items: evaluatedItems,
      totals: aggregateQuoteTotals(evaluatedItems),
    };
  };

  const estimateItems = (
    items: (Partial<RawQuoteItem> | null | undefined)[],
  ): { items: QuoteItemEstimate[]; totals: QuoteTotals } => {
    const evaluation = evaluateItems(items);
    return {
      totals: evaluation.totals,
      items: evaluation.items.map((item) => ({
        ...item,
        pieceOptions: item.product
          ? (baselines[item.product]?.pieceOptions ?? [])
          : [],
        isPieceUnit: isPieceUnit(item.unit),
        /*
         * The per-kilogram figure the form's hint shows. Distinct from
         * `unitPriceRial`, which is per *order* unit -- per tonne, per branch
         * -- and is what the printed sheet's «مبلغ واحد» column carries.
         */
        unitPriceTomanPerKg:
          item.weightInKg && item.approximateTotalToman !== null
            ? Math.round(item.approximateTotalToman / item.weightInKg)
            : null,
        availableUnits: item.supportsPieceUnits
          ? [...quoteUnits]
          : quoteUnits.filter((unit) => !isPieceUnit(unit)),
      })),
    };
  };

  const applyItemChange = (
    item: RawQuoteItem,
    patch: Partial<RawQuoteItem>,
  ): RawQuoteItem => {
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
      !quoteProductSupportsPieceUnits(patched.product)
    ) {
      return { ...patched, unit: "تن" };
    }
    return patched;
  };

  const evaluateRequest = (
    request: RawQuoteRequest,
  ): QuoteEvaluationResult => {
    const normalizedContact = normalizeQuoteContact(request.contact);
    const validation = validateQuoteRequestInput({
      contact: normalizedContact,
      items: request.items,
      acceptDisclaimer: request.acceptDisclaimer,
    });
    const { items, totals } = evaluateItems(request.items);
    const message = buildQuoteMessage(normalizedContact, items, totals);
    const document = buildQuoteDocument(normalizedContact, items, totals);

    return {
      input: {
        contact: normalizedContact,
        items: request.items,
        acceptDisclaimer: request.acceptDisclaimer,
      },
      validation,
      items,
      totals,
      message,
      document,
    };
  };

  return { estimateItems, applyItemChange, evaluateRequest };
}
