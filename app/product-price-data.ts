import { createRetryableLoader } from "./catalog-cache";
import type { CatalogCategory, CatalogPriceData } from "./catalog-types";

export type ProductCatalogId =
  | "sheet"
  | "profile"
  | "pipe"
  | "angle"
  | "channel"
  | "wire";

export type ProductPriceCatalog = {
  id: ProductCatalogId;
  label: string;
  initialCategoryId: string;
  categories: CatalogCategory[];
};

export type ProductPricePayload = Omit<CatalogPriceData, "categories"> & {
  catalogs: ProductPriceCatalog[];
};

// Validated at build time by scripts/validate-price-data.mjs, not again here.
export const loadProductPricePayload = createRetryableLoader(
  () =>
    import("./data/product-prices.json").then(
      (module) => module.default,
    ) as Promise<ProductPricePayload>,
);

