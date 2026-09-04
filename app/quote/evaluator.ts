import {
  aggregateQuoteTotals,
  evaluateItemPricing,
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
  RawQuoteItem,
  RawQuoteRequest,
} from "../quote-types";
import { quoteProductSupportsPieceUnits } from "../quote-types";

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
    evaluateRequest,
    getPieceOptions,
    supportsPieceUnits,
    requiresRebarDiameter,
  };
}
