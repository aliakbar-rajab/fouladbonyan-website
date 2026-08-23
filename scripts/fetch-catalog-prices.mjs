import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCatalogSnapshot } from "./lib/build-price-payloads.mjs";
import { writeSnapshot } from "./fooladiranian.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "catalog-prices.json",
);

const fallbackSnapshot = await readFile(outputPath, "utf8")
  .then((data) => JSON.parse(data))
  .catch(() => null);

const { snapshot, diagnostics } = await buildCatalogSnapshot({
  fallbackSnapshot,
});

await writeSnapshot(
  outputPath,
  snapshot,
  (rows) =>
    `قیمت‌های کاتالوگ با موفقیت از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف (${diagnostics.freshCategories} دسته تازه، ${diagnostics.fallbackCategories} دسته از نسخه پشتیبان)`,
);
