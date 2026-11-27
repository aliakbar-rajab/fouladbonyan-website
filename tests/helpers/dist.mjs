import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileStaticSite } from "../../scripts/lib/prerender-pipeline.mjs";

/** Read one file out of the production build. */
export const readDist = (path) =>
  readFile(new URL(`../../dist/${path}`, import.meta.url), "utf8");

/** Read one committed price snapshot. */
export const readJson = (path) =>
  readFile(new URL(`../../app/data/${path}`, import.meta.url), "utf8").then(
    JSON.parse,
  );

let compiledSitePromise = null;

/**
 * Compiles the full static site once in memory from repo-root index.html and
 * the committed catalog snapshot, with no Vite build or dist/ read required.
 */
export const loadCompiledSite = () => {
  if (!compiledSitePromise) {
    compiledSitePromise = Promise.all([
      readFile(new URL("../../index.html", import.meta.url), "utf8"),
      readJson("catalog-prices.json"),
    ]).then(([templateHtml, snapshot]) =>
      compileStaticSite({ templateHtml, snapshot }),
    );
  }
  return compiledSitePromise;
};

/** Read one virtual file out of the in-process compiled static site. */
export const readCompiled = async (path) => {
  const site = await loadCompiledSite();
  const content = site.files.get(path);
  assert.ok(content !== undefined, `Expected compiled virtual file "${path}"`);
  return content;
};

/**
 * Every product group's categories, in the `{ id, categories }` shape the app
 * reads through `loadGroupCatalog`. Built from the committed snapshots so a
 * test can assert against the same data the build prerendered from.
 */
export const loadGroupCatalogs = async () => {
  const snapshot = await readJson("catalog-prices.json");
  return snapshot.catalogs.map((catalog) => ({
    id: catalog.id,
    label: catalog.label,
    categories: catalog.categories,
  }));
};

/** The BreadcrumbList JSON-LD a generated page emits, parsed. */
export const parseBreadcrumbLd = (html, label) => {
  const raw = html.match(
    /<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"BreadcrumbList".*?)<\/script>/,
  )?.[1];
  assert.ok(raw, label);
  return JSON.parse(raw);
};
