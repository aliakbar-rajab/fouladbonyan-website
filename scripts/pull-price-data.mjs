import { resolve } from "node:path";
import { validateCatalogSnapshot } from "../app/catalog-validation.mjs";
import { allCatalogConfigs } from "./price-catalog-config.mjs";
import { pullDataset } from "./lib/pull-price-data-core.mjs";

// Runs as part of `npm run build`. Pulls the latest validated snapshot from
// the Cloudflare Worker that owns scheduled refreshing
// (workers/price-refresh), replacing the committed app/data/catalog-prices.json
// file with it for this build only -- nothing here is written back to git.
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

const result = await pullDataset({
  endpoint,
  name: "catalog-prices",
  outputPath: resolve(dataDir, "catalog-prices.json"),
  validate: (data) =>
    validateCatalogSnapshot(data, {
      expectedCatalogs: allCatalogConfigs.map((catalog) => ({
        id: catalog.id,
        categoryIds: catalog.sources.map((source) => source.id),
      })),
    }),
});

if (result.ok) {
  console.log(
    `catalog-prices: با نسخه Cloudflare (${result.fetchedAt}) جایگزین شد.`,
  );
} else {
  console.warn(
    `catalog-prices: دریافت از Cloudflare ناموفق بود (${result.error})؛ نسخه موجود در مخزن حفظ شد.`,
  );
}

