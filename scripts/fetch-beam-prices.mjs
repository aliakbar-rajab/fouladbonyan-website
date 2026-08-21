import { resolve } from "node:path";
import { buildBeamPayload } from "./lib/build-price-payloads.mjs";
import { writeSnapshot } from "./fooladiranian.mjs";

const outputPath = resolve(
  import.meta.dirname,
  "..",
  "app",
  "data",
  "beam-prices.json",
);

await writeSnapshot(
  outputPath,
  await buildBeamPayload(),
  (rows) =>
    `قیمت‌های تیرآهن از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف`,
);
