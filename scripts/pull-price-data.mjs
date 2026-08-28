import { resolve } from "node:path";
import { pullPriceSnapshot } from "./lib/price-pipeline.mjs";

const endpoint = process.env.PRICE_DATA_ENDPOINT;
const dataDir = resolve(import.meta.dirname, "..", "app", "data");

if (!endpoint) {
  console.log(
    "PRICE_DATA_ENDPOINT تنظیم نشده است؛ از داده‌های قیمت موجود در مخزن استفاده می‌شود.",
  );
  process.exit(0);
}

const result = await pullPriceSnapshot({
  endpoint,
  outputPath: resolve(dataDir, "catalog-prices.json"),
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
