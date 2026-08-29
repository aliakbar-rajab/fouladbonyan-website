import { createRetryableLoader, loadAllGroupCatalogs } from "../catalog-reader";
import { createQuoteEvaluator, type QuoteEvaluator } from "../quote-engine";
import type { CatalogSnapshot, GroupCatalog } from "../catalog-types";
import { extractQuotePricingBaselines } from "./pricing-source";

export function createQuoteEvaluatorFromCatalog(
  source: CatalogSnapshot | GroupCatalog[] | null | undefined,
): QuoteEvaluator {
  return createQuoteEvaluator(extractQuotePricingBaselines(source));
}

export const loadQuoteEvaluator = createRetryableLoader<QuoteEvaluator>(
  async () => createQuoteEvaluatorFromCatalog(await loadAllGroupCatalogs()),
);
