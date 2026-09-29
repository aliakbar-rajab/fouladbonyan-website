import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateCatalogSnapshot } from "../app/catalog-validation.mjs";

const readJson = async (path) =>
  JSON.parse(await readFile(resolve(import.meta.dirname, "..", path), "utf8"));

const snapshot = await readJson("app/data/catalog-prices.json");

validateCatalogSnapshot(snapshot);

console.log("اعتبارسنجی ساختاری و معنایی همه داده‌های قیمت با موفقیت انجام شد.");

