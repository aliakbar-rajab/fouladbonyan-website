import { resolve } from "node:path";
import { buildRebarPayload } from "./lib/build-price-payloads.mjs";
import { writeSnapshot } from "./fooladiranian.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "rebar-prices.json",
);

await writeSnapshot(
  outputPath,
  await buildRebarPayload(),
  (rows) =>
    `قیمت‌های میلگرد از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف`,
);
