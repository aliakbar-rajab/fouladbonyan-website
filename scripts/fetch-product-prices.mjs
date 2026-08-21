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

const payload = await buildProductPayload();
const categoryCount = payload.catalogs.flatMap((catalog) => catalog.categories).length;

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت تمام محصولات از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف در ${categoryCount.toLocaleString("fa-IR")} دسته`,
);
