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
import {
  createQuoteRequestEstimate,
  type QuoteRequestEstimate,
} from "./quote-request-estimate";

const loadQuoteEvaluator = createRetryableLoader<QuoteEvaluator>(
  async () =>
    createQuoteEvaluator(
      extractQuotePricingBaselines(await loadAllGroupCatalogs()),
    ),
);

const emptyEvaluator = createQuoteEvaluator();
const emptyEstimate = createQuoteRequestEstimate(emptyEvaluator);

export function useQuoteRequestEstimate() {
  const [loaded, setLoaded] = useState<{
    estimate: QuoteRequestEstimate;
    evaluator: QuoteEvaluator;
  } | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    loadQuoteEvaluator()
      .then((evaluator) => {
        if (!active) return;
        setLoaded({
          estimate: createQuoteRequestEstimate(evaluator),
          evaluator,
        });
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
      estimate: loaded?.estimate ?? emptyEstimate,
      evaluator: loaded?.evaluator ?? emptyEvaluator,
      isLoading: !loaded && !loadError,
      loadError,
    }),
    [loaded, loadError],
  );
}
