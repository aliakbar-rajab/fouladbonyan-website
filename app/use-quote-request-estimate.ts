import { useEffect, useMemo, useState } from "react";
import {
  createQuoteRequestEstimate,
  type QuoteRequestEstimate,
} from "./quote-request-estimate";
import { loadQuoteEvaluator } from "./quote/catalog-pricing-adapter";

const emptyEstimate = createQuoteRequestEstimate();

export function useQuoteRequestEstimate() {
  const [loadedEstimate, setLoadedEstimate] =
    useState<QuoteRequestEstimate | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    loadQuoteEvaluator()
      .then((evaluator) => {
        if (!active) return;
        setLoadedEstimate(createQuoteRequestEstimate(evaluator));
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
      estimate: loadedEstimate ?? emptyEstimate,
      isLoading: !loadedEstimate && !loadError,
      loadError,
    }),
    [loadedEstimate, loadError],
  );
}
