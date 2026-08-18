import { resolve } from "node:path";
import { validateCatalogPriceData } from "../app/catalog-validation.mjs";
import { rebarSources } from "./price-catalog-config.mjs";
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
  "rebar-prices.json",
);

const sources = rebarSources.map((source) => ({ ...source, url: sourceUrl(source.slug) }));

const payload = {
  fetchedAt: new Date().toISOString(),
  ...SOURCE_ENVELOPE,
  categories: await fetchCategories(sources),
};
validateCatalogPriceData(payload, {
  expectedCategoryIds: sources.map((source) => source.id),
});

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت‌های میلگرد از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف`,
);
