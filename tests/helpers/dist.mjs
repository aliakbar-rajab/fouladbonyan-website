import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

/** Read one file out of the production build. */
export const readDist = (path) =>
  readFile(new URL(`../../dist/${path}`, import.meta.url), "utf8");

/** Read one committed price snapshot. */
export const readJson = (path) =>
  readFile(new URL(`../../app/data/${path}`, import.meta.url), "utf8").then(
    JSON.parse,
  );

/**
 * Every product group's categories, in the `{ id, categories }` shape the app
 * reads through `loadGroupCatalog`. Built from the committed snapshots so a
 * test can assert against the same data the build prerendered from.
 */
export const loadGroupCatalogs = async () => {
  const [rebar, beam, products] = await Promise.all([
    readJson("rebar-prices.json"),
    readJson("beam-prices.json"),
    readJson("product-prices.json"),
  ]);

  return [
    { id: "rebar", categories: rebar.categories },
    { id: "beam", categories: beam.categories },
    ...products.catalogs.map((catalog) => ({
      id: catalog.id,
      categories: catalog.categories,
    })),
  ];
};

/** The BreadcrumbList JSON-LD a generated page emits, parsed. */
export const parseBreadcrumbLd = (html, label) => {
  const raw = html.match(
    /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/,
  )?.[1];
  assert.ok(raw, label);
  return JSON.parse(raw);
};
