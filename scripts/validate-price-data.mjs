import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateCatalogPriceData,
  validateProductPricePayload,
} from "../app/catalog-validation.mjs";
import { rebarSources, beamSources, productCatalogs } from "./price-catalog-config.mjs";

const readJson = async (path) =>
  JSON.parse(await readFile(resolve(import.meta.dirname, "..", path), "utf8"));

const rebar = await readJson("app/data/rebar-prices.json");
const beam = await readJson("app/data/beam-prices.json");
const products = await readJson("app/data/product-prices.json");

validateCatalogPriceData(rebar, {
  expectedCategoryIds: rebarSources.map((source) => source.id),
});
validateCatalogPriceData(beam, {
  expectedCategoryIds: beamSources.map((source) => source.id),
});
validateProductPricePayload(products, {
  expectedCatalogs: productCatalogs.map((catalog) => ({
    id: catalog.id,
    categoryIds: catalog.sources.map((source) => source.id),
  })),
});

console.log("اعتبارسنجی ساختاری و معنایی همه داده‌های قیمت با موفقیت انجام شد.");
