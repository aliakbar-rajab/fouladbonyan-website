import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildProductPayload } from "./lib/build-price-payloads.mjs";
import { writeSnapshot } from "./fooladiranian.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "product-prices.json",
);

const fallbackPayload = await readFile(outputPath, "utf8")
  .then((data) => JSON.parse(data))
  .catch(() => null);

const payload = await buildProductPayload({ fallbackPayload });
const categoryCount = payload.catalogs.flatMap((catalog) => catalog.categories).length;

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت تمام محصولات از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف در ${categoryCount.toLocaleString("fa-IR")} دسته`,
);

