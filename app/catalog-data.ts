import { createRetryableLoader } from "./catalog-cache";
import type { CatalogPriceData } from "./catalog-types";

// These snapshots are committed, and `npm run build` runs the full semantic
// validation over them (scripts/validate-price-data.mjs) before bundling, so
// re-checking the same bytes in every visitor's browser buys nothing.
export const loadRebarPriceData = createRetryableLoader(
  () =>
    import("./data/rebar-prices.json").then(
      (module) => module.default,
    ) as Promise<CatalogPriceData>,
);

export const loadBeamPriceData = createRetryableLoader(
  () =>
    import("./data/beam-prices.json").then(
      (module) => module.default,
    ) as Promise<CatalogPriceData>,
);
