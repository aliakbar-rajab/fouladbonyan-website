import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pullPriceSnapshot } from "./lib/price-pipeline.mjs";

const endpoint = process.env.PRICE_DATA_ENDPOINT;
const requireFresh = process.env.REQUIRE_FRESH_PRICES === "1";
const dataDir = resolve(import.meta.dirname, "..", "app", "data");
const outputPath = resolve(dataDir, "catalog-prices.json");

async function describeLocalSnapshot(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    const fetchedMs = Date.parse(parsed.fetchedAt);
    if (!Number.isFinite(fetchedMs)) {
      return `fetchedAt=${String(parsed.fetchedAt ?? "نامشخص")}`;
    }
    const ageHours = Math.max(0, (Date.now() - fetchedMs) / 3_600_000);
    return `fetchedAt=${parsed.fetchedAt} (سن اسنپ‌شات محلی: ${ageHours.toFixed(1)} ساعت)`;
  } catch {
    return "بدون اسنپ‌شات محلی خوانا";
  }
}

if (!endpoint) {
  const localSummary = await describeLocalSnapshot(outputPath);
  console.log(
    `PRICE_DATA_ENDPOINT تنظیم نشده است؛ از داده‌های قیمت موجود در مخزن استفاده می‌شود (${localSummary}).`,
  );
  process.exit(0);
}

const result = await pullPriceSnapshot({
  endpoint,
  outputPath,
});

if (result.ok) {
  console.log(
    `catalog-prices: با نسخه Cloudflare (${result.fetchedAt}) جایگزین شد.`,
  );
} else {
  const localSummary = await describeLocalSnapshot(outputPath);
  console.warn(
    `catalog-prices: دریافت از Cloudflare ناموفق بود (${result.error})؛ نسخه موجود در مخزن حفظ شد (${localSummary}).`,
  );
  if (requireFresh) {
    process.exit(1);
  }
}
