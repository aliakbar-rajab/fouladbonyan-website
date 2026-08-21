import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Fetch/parse logic lives in lib/catalog-source.mjs, free of node built-ins,
// so the Cloudflare Worker that now owns scheduled refreshing
// (workers/price-refresh) can import it directly. This file adds the
// filesystem-writing side, used only by the local manual scripts
// (scripts/fetch-*-prices.mjs) that regenerate the committed seed data.
export { SOURCE_ENVELOPE, fetchCategories, sourceUrl } from "./lib/catalog-source.mjs";

export async function writeSnapshot(outputPath, payload, describe) {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(payload)}\n`);
  await rename(temporaryPath, outputPath);
  console.log(describe(countRows(payload)));
}

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
