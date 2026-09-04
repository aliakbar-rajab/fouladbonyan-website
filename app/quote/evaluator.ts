import {
  aggregateQuoteTotals,
  evaluateItemPricing,
  isPieceUnit,
} from "./calculation";
import type { QuotePricingBaselines } from "./pricing-types";
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
  QuoteProductName,
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

export type QuoteEvaluator = {
  /** Evaluate a single line item against market pricing baselines. */
  evaluateItem: (
    item: Partial<RawQuoteItem> | null | undefined,
  ) => QuoteItemEvaluation;

  /** Evaluate multiple line items and compute aggregated totals. */
  evaluateItems: (items: (Partial<RawQuoteItem> | null | undefined)[]) => {
    items: QuoteItemEvaluation[];
    totals: QuoteTotals;
  };

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

  /** Retrieve piece unit options for a product from catalog pricing. */
  getPieceOptions: (product: QuoteProductName | "") => QuotePieceOptionChoice[];

  /** Whether the product supports piece units (branch/piece). */
  supportsPieceUnits: (product: QuoteProductName | "") => boolean;

  /** Whether the product requires rebar diameter for piece weight calculations. */
  requiresRebarDiameter: (product: QuoteProductName | "") => boolean;
};

/**
 * Construct a QuoteEvaluator over already-derived pricing baselines.
 * Catalog translation belongs to the infrastructure layer (pricing-source).
 */
export function createQuoteEvaluator(
  source?: QuotePricingBaselines | null,
): QuoteEvaluator {
  const baselines = source ?? {};

  const evaluateItem = (
    item: Partial<RawQuoteItem> | null | undefined,
  ): QuoteItemEvaluation => evaluateItemPricing(item, baselines);

  const evaluateItems = (
    items: (Partial<RawQuoteItem> | null | undefined)[],
  ): { items: QuoteItemEvaluation[]; totals: QuoteTotals } => {
    const evaluatedItems = (items ?? []).map(evaluateItem);
    const totals = aggregateQuoteTotals(evaluatedItems);
    return { items: evaluatedItems, totals };
  };

  const estimateItems = (
    items: (Partial<RawQuoteItem> | null | undefined)[],
  ): { items: QuoteItemEstimate[]; totals: QuoteTotals } => {
    const evaluation = evaluateItems(items);
    return {
      totals: evaluation.totals,
      items: evaluation.items.map((item) => ({
        ...item,
        pieceOptions: getPieceOptions(item.product),
        isPieceUnit: item.unit === "شاخه" || item.unit === "عدد",
        unitPriceTomanPerKg:
          item.weightInKg && item.approximateTotalToman !== null
            ? Math.round(item.approximateTotalToman / item.weightInKg)
            : null,
        availableUnits: supportsPieceUnits(item.product)
          ? [...quoteUnits]
          : quoteUnits.filter((unit) => unit !== "شاخه" && unit !== "عدد"),
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
      !supportsPieceUnits(patched.product)
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

  const getPieceOptions = (
    product: QuoteProductName | "",
  ): QuotePieceOptionChoice[] => {
    if (!product || !baselines[product]) return [];
    return baselines[product]?.pieceOptions ?? [];
  };

  const supportsPieceUnits = (product: QuoteProductName | ""): boolean => {
    return quoteProductSupportsPieceUnits(product);
  };

  const requiresRebarDiameter = (product: QuoteProductName | ""): boolean => {
    if (!product || !baselines[product]) return false;
    return Boolean(baselines[product]?.branchWeight);
  };

  return {
    evaluateItem,
    evaluateItems,
    estimateItems,
    applyItemChange,
    evaluateRequest,
    getPieceOptions,
    supportsPieceUnits,
    requiresRebarDiameter,
  };
}
