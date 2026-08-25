import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildCatalogSnapshot } from "./lib/build-price-payloads.mjs";

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

async function writeSnapshot(targetPath, payload) {
  await mkdir(dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(payload)}\n`);
  await rename(temporaryPath, targetPath);
}

const fallbackSnapshot = await readFile(outputPath, "utf8")
  .then((data) => JSON.parse(data))
  .catch(() => null);

const { snapshot, diagnostics } = await buildCatalogSnapshot({
  fallbackSnapshot,
});

await writeSnapshot(outputPath, snapshot);
console.log(
  `قیمت‌های کاتالوگ با موفقیت از منبع بروزرسانی شد: ${countRows(snapshot).toLocaleString("fa-IR")} ردیف (${diagnostics.freshCategories} دسته تازه، ${diagnostics.fallbackCategories} دسته از نسخه پشتیبان)`,
);
