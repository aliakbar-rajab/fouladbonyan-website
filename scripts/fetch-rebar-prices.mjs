import { readFile } from "node:fs/promises";
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

const fallbackPayload = await readFile(outputPath, "utf8")
  .then((data) => JSON.parse(data))
  .catch(() => null);

const payload = await buildRebarPayload({ fallbackPayload });

await writeSnapshot(
  outputPath,
  payload,
  (rows) =>
    `قیمت‌های میلگرد از منبع بروزرسانی شد: ${rows.toLocaleString("fa-IR")} ردیف`,
);

