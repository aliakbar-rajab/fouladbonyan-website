import { resolve } from "node:path";
import {
  validateCatalogPriceData,
  validateProductPricePayload,
} from "../app/catalog-validation.mjs";
import { rebarSources, beamSources, productCatalogs } from "./price-catalog-config.mjs";
import { pullDataset } from "./lib/pull-price-data-core.mjs";

// Runs as part of `npm run build`. Pulls the latest validated snapshots from
// the Cloudflare Worker that now owns scheduled refreshing
// (workers/price-refresh), replacing the committed app/data/*.json files
// with them for this build only -- nothing here is written back to git.
//
// PRICE_DATA_ENDPOINT is set as a Cloudflare Pages build environment
// variable in production. Left unset (local dev, PR checks), this is a
// no-op and the build uses the committed seed data as-is.
const endpoint = process.env.PRICE_DATA_ENDPOINT;
const dataDir = resolve(import.meta.dirname, "..", "app", "data");

if (!endpoint) {
  console.log(
    "PRICE_DATA_ENDPOINT تنظیم نشده است؛ از داده‌های قیمت موجود در مخزن استفاده می‌شود.",
  );
  process.exit(0);
}

const jobs = [
  {
    name: "rebar-prices",
    outputPath: resolve(dataDir, "rebar-prices.json"),
    validate: (data) =>
      validateCatalogPriceData(data, {
        expectedCategoryIds: rebarSources.map((source) => source.id),
      }),
  },
  {
    name: "beam-prices",
    outputPath: resolve(dataDir, "beam-prices.json"),
    validate: (data) =>
      validateCatalogPriceData(data, {
        expectedCategoryIds: beamSources.map((source) => source.id),
      }),
  },
  {
    name: "product-prices",
    outputPath: resolve(dataDir, "product-prices.json"),
    validate: (data) =>
      validateProductPricePayload(data, {
        expectedCatalogs: productCatalogs.map((catalog) => ({
          id: catalog.id,
          categoryIds: catalog.sources.map((source) => source.id),
        })),
      }),
  },
];

const results = await Promise.all(
  jobs.map((job) =>
    pullDataset({
      endpoint,
      name: job.name,
      outputPath: job.outputPath,
      validate: job.validate,
    }),
  ),
);

results.forEach((result, index) => {
  const { name } = jobs[index];
  if (result.ok) {
    console.log(`${name}: با نسخه Cloudflare (${result.fetchedAt}) جایگزین شد.`);
  } else {
    console.warn(
      `${name}: دریافت از Cloudflare ناموفق بود (${result.error})؛ نسخه موجود در مخزن حفظ شد.`,
    );
  }
});
