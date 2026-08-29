import {
  aggregateQuoteTotals,
  evaluateItemPricing,
  formatToman,
} from "./quote/calculation";
import type { QuotePricingBaselines } from "./quote/pricing-types";
import {
  buildQuoteDocument,
  buildQuoteMessage,
} from "./quote/serialization";
import {
  normalizeQuoteContact,
  validateQuoteField,
  validateQuoteRequestInput,
  type FieldValidationOptions,
} from "./quote/validation";
import {
  isQuoteProduct,
  isQuoteUnit,
  quoteDisclaimer,
  quoteProductNames,
  quoteUnits,
  type GeneratedQuote,
  type GeneratedQuoteItem,
  type QuoteEvaluationResult,
  type QuoteItemEvaluation,
  type QuotePieceOptionChoice,
  type QuoteProductName,
  type QuoteTotals,
  type QuoteUnit,
  type QuoteValidationResult,
  type RawQuoteContact,
  type RawQuoteItem,
  type RawQuoteRequest,
} from "./quote-types";

// ---------------------------------------------------------------------------
// 1. PUBLIC DOMAIN METADATA & UI VALUES
// ---------------------------------------------------------------------------

export {
  formatToman,
  isQuoteProduct,
  isQuoteUnit,
  quoteDisclaimer,
  quoteProductNames,
  quoteUnits,
};

export type {
  GeneratedQuote,
  GeneratedQuoteItem,
  QuoteEvaluationResult,
  QuoteItemEvaluation,
  QuotePieceOptionChoice,
  QuoteProductName,
  QuoteTotals,
  QuoteUnit,
  QuoteValidationResult,
  RawQuoteContact,
  RawQuoteItem,
  RawQuoteRequest,
};

// ---------------------------------------------------------------------------
// 2. PURE QUOTE OPERATIONS — no pricing baselines, no catalog load required
// ---------------------------------------------------------------------------

/** Validate a single form field. Returns empty string if valid, error message otherwise. */
export { validateQuoteField };

/** Validate a complete quote request input (contact, items, disclaimer). */
export { validateQuoteRequestInput };

/** Format already-evaluated items/totals into a human-readable Persian copy message. */
export { buildQuoteMessage };

/** Generate the final printable invoice/quote document from already-evaluated items/totals. */
export { buildQuoteDocument };

export type { FieldValidationOptions };

// ---------------------------------------------------------------------------
// 3. BASELINE-BOUND QUOTE EVALUATOR — pricing-dependent operations only
// ---------------------------------------------------------------------------

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
 * Catalog translation belongs to the infrastructure adapter.
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
    if (!product || !baselines[product]) return true;
    return baselines[product]?.supportsPieceUnits ?? true;
  };

  const requiresRebarDiameter = (product: QuoteProductName | ""): boolean => {
    if (!product || !baselines[product]) return false;
    return Boolean(baselines[product]?.branchWeight);
  };

  return {
    evaluateItem,
    evaluateItems,
    evaluateRequest,
    getPieceOptions,
    supportsPieceUnits,
    requiresRebarDiameter,
  };
}
