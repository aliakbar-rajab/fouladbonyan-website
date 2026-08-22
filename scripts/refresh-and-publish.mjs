import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildAllPayloads } from "./lib/build-price-payloads.mjs";
import { publishPayloads } from "./lib/publish-price-payloads.mjs";

// Entry point for the scheduled GitHub Actions relay
// (.github/workflows/price-refresh.yml): fetch + validate the three
// datasets from the live source, then hand them to the Cloudflare Worker,
// which validates them again and, only if they pass, stores them and
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

async function loadFallbackDataset(name, fileName) {
  // 1. Try to load from Cloudflare Worker (latest published snapshot)
  try {
    const response = await fetch(`${endpoint}/${name}.json`, {
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
    const content = await readFile(resolve(dataDir, fileName), "utf8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

const [rebarFallback, beamFallback, productFallback] = await Promise.all([
  loadFallbackDataset("rebar-prices", "rebar-prices.json"),
  loadFallbackDataset("beam-prices", "beam-prices.json"),
  loadFallbackDataset("product-prices", "product-prices.json"),
]);

const fallbacks = {
  rebar: rebarFallback,
  beam: beamFallback,
  product: productFallback,
};

console.log("در حال دریافت و اعتبارسنجی قیمت‌ها از منبع...");
const { rebar, beam, product, diagnostics } = await buildAllPayloads({ fallbacks });

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
  payloads: { rebar, beam, product, diagnostics },
});

console.log(`داده‌های قیمت با موفقیت به Cloudflare ارسال و منتشر شد: ${JSON.stringify(result)}`);

