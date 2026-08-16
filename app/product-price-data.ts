import { createRetryableLoader } from "./catalog-cache";
import type {
  CatalogCategory,
  CatalogPriceData,
  CatalogViewRequest,
} from "./catalog-types";

export type ProductCatalogId =
  | "sheet"
  | "profile"
  | "pipe"
  | "angle"
  | "channel"
  | "wire";

export type ProductViewRequest = CatalogViewRequest;

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

export async function loadProductPriceCatalog(catalogId: ProductCatalogId) {
  const payload = await loadProductPricePayload();
  const catalog = payload.catalogs.find((item) => item.id === catalogId);
  if (!catalog) {
    throw new Error(`داده قیمت گروه ${catalogId} در دسترس نیست.`);
  }
  return catalog;
}
