import { useMemo } from "react";
import {
  createRetryableLoader,
  loadAllGroupCatalogs,
} from "./catalog-reader";
import { useCatalogData } from "./use-catalog-data";
import {
  createQuoteEvaluator,
  type QuoteEvaluator,
} from "./quote/evaluator";
import { extractQuotePricingBaselines } from "./quote/pricing-source";

const loadQuoteEvaluator = createRetryableLoader<QuoteEvaluator>(
  async () =>
    createQuoteEvaluator(
      extractQuotePricingBaselines(await loadAllGroupCatalogs()),
    ),
);

/*
 * There is one evaluator for the whole site, so the key is a constant -- the
 * loading, error and retry behaviour is otherwise exactly what every other
 * catalog-backed panel needs, and lives in useCatalogData.
 */
const emptyEvaluator = createQuoteEvaluator();

export function useQuoteRequestEstimate() {
  const state = useCatalogData(loadQuoteEvaluator, "quote");
  const evaluator = state.status === "ready" ? state.data : emptyEvaluator;

  return useMemo(
    () => ({
      evaluator,
      isLoading: state.status === "loading",
      loadError: state.status === "error",
    }),
    [evaluator, state.status],
  );
}
