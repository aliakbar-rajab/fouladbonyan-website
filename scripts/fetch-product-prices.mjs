import { resolve } from "node:path";
import { validateProductPricePayload } from "../app/catalog-validation.mjs";
import { productCatalogs, productDetailKeys } from "./price-catalog-config.mjs";
import {
  SOURCE_ENVELOPE,
  fetchCategories,
  sourceUrl,
  writeSnapshot,
} from "./fooladiranian.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "product-prices.json",
);

const source = (raw) => ({
  id: raw.id,
  label: raw.label,
  url: sourceUrl(raw.slug),
  specificationKey: raw.specificationKey ?? "ضخامت",
  groupingLabel: raw.groupingLabel ?? "کارخانه",
  detailKeys: productDetailKeys,
});

const catalogs = productCatalogs.map((catalog) => ({
  ...catalog,
  sources: catalog.sources.map(source),
}));

const fetched = await fetchCategories(catalogs.flatMap((catalog) => catalog.sources));
const categoriesById = new Map(
  fetched.map((category) => [category.id, category]),
);

const payload = {
  fetchedAt: new Date().toISOString(),
  ...SOURCE_ENVELOPE,
  catalogs: catalogs.map((catalog) => ({
    id: catalog.id,
    label: catalog.label,
    initialCategoryId: catalog.initialCategoryId,
    categories: catalog.sources.map((item) => categoriesById.get(item.id)),
  })),
};
validateProductPricePayload(payload, {
  expectedCatalogs: catalogs.map((catalog) => ({
    id: catalog.id,
    categoryIds: catalog.sources.map((item) => item.id),
  })),
});

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت تمام محصولات از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف در ${fetched.length.toLocaleString("fa-IR")} دسته`,
);
