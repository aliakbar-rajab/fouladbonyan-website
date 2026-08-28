import { resolve } from "node:path";
import { updateLocalPriceSnapshot } from "./lib/price-pipeline.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "catalog-prices.json",
);

function countRows(payload) {
  const categories =
    payload.categories ??
    payload.catalogs.flatMap((catalog) => catalog.categories);
  return categories.reduce(
    (total, category) =>
      total +
      category.factories.reduce(
        (factoryTotal, factory) => factoryTotal + factory.rows.length,
        0,
      ),
    0,
  );
}

const { snapshot, diagnostics } = await updateLocalPriceSnapshot({
  outputPath,
});

console.log(
  `قیمت‌های کاتالوگ با موفقیت از منبع بروزرسانی شد: ${countRows(snapshot).toLocaleString("fa-IR")} ردیف (${diagnostics.freshCategories} دسته تازه، ${diagnostics.fallbackCategories} دسته از نسخه پشتیبان)`,
);
