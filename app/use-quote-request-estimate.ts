import { useEffect, useMemo, useState } from "react";
import {
  createRetryableLoader,
  loadAllGroupCatalogs,
} from "./catalog-reader";
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

const emptyEvaluator = createQuoteEvaluator();

export function useQuoteRequestEstimate() {
  const [evaluator, setEvaluator] = useState<QuoteEvaluator | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    loadQuoteEvaluator()
      .then((loaded) => {
        if (!active) return;
        setEvaluator(loaded);
        setLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  return useMemo(
    () => ({
      evaluator: evaluator ?? emptyEvaluator,
      isLoading: !evaluator && !loadError,
      loadError,
    }),
    [evaluator, loadError],
  );
}
