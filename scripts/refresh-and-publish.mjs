import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCatalogSnapshot } from "./lib/build-price-payloads.mjs";
import { publishPayloads } from "./lib/publish-price-payloads.mjs";

// Entry point for the scheduled GitHub Actions relay
// (.github/workflows/price-refresh.yml): fetch + validate the canonical
// catalog snapshot from the live source, then hand it to the Cloudflare Worker,
// which validates it again and, only if it passes, stores it and
// triggers a Pages rebuild. This process never touches git -- there is
// nothing here that reads or writes app/data, and nothing that commits or
// pushes.
const endpoint = process.env.PRICE_DATA_ENDPOINT;
const token = process.env.PRICE_INGEST_TOKEN;

if (!endpoint || !token) {
  console.error(
    "PRICE_DATA_ENDPOINT و PRICE_INGEST_TOKEN باید هر دو تنظیم شده باشند.",
  );
  process.exit(1);
}

const dataDir = resolve(import.meta.dirname, "..", "app", "data");

async function loadFallbackSnapshot() {
  // 1. Try to load from Cloudflare Worker (latest published snapshot)
  try {
    const response = await fetch(`${endpoint}/catalog-prices.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (response.ok) {
      return await response.json();
    }
  } catch {
    // Worker not reachable or not yet populated, continue to local disk fallback
  }

  // 2. Fall back to local committed seed data in repository
  try {
    const content = await readFile(
      resolve(dataDir, "catalog-prices.json"),
      "utf8",
    );
    return JSON.parse(content);
  } catch {
    return null;
  }
}

const fallbackSnapshot = await loadFallbackSnapshot();

console.log("در حال دریافت و اعتبارسنجی قیمت‌ها از منبع...");
const { snapshot, diagnostics } = await buildCatalogSnapshot({
  fallbackSnapshot,
});

console.log(
  `آمار بروزرسانی: ${diagnostics.freshCategories.toLocaleString("fa-IR")} دسته جدید، ${diagnostics.fallbackCategories.toLocaleString("fa-IR")} دسته از نسخه پشتیبان معتبر.`,
);

if (diagnostics.warnings.length > 0) {
  console.warn("هشدارهای ایزوله‌سازی خطا در دسته‌ها:");
  diagnostics.warnings.forEach((w) => console.warn(` - ${w.message ?? w}`));
}

const result = await publishPayloads({
  endpoint,
  token,
  payloads: { snapshot, diagnostics },
});

console.log(
  `داده‌های قیمت با موفقیت به Cloudflare ارسال و منتشر شد: ${JSON.stringify(result)}`,
);


