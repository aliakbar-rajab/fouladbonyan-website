import type { CatalogCategory, CatalogPriceData } from "./catalog-types";
import { loadProductSnapshot } from "./group-catalog";

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

export const loadProductPricePayload = loadProductSnapshot;


