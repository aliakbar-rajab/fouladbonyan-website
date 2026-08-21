import {
  rebarSources,
  beamSources,
  productCatalogs,
  productDetailKeys,
} from "../price-catalog-config.mjs";
import { SOURCE_ENVELOPE, fetchCategories, sourceUrl } from "./catalog-source.mjs";
import {
  validateCatalogPriceData,
  validateProductPricePayload,
} from "../../app/catalog-validation.mjs";

// The one place that assembles a full, validated rebar/beam/product payload
// from the live source. Used by the local manual scripts
// (scripts/fetch-*-prices.mjs, which write the result to app/data/*.json)
// and by scripts/refresh-and-publish.mjs (which the scheduled GitHub Actions
// relay runs, POSTing the result to the Cloudflare Worker instead).
async function buildCatalogPayload(sources, expectedCategoryIds) {
  const resolved = sources.map((source) => ({
    ...source,
    url: sourceUrl(source.slug),
  }));
  const payload = {
    fetchedAt: new Date().toISOString(),
    ...SOURCE_ENVELOPE,
    categories: await fetchCategories(resolved),
  };
  validateCatalogPriceData(payload, { expectedCategoryIds });
  return payload;
}

export async function buildRebarPayload() {
  return buildCatalogPayload(rebarSources, rebarSources.map((source) => source.id));
}

export async function buildBeamPayload() {
  return buildCatalogPayload(beamSources, beamSources.map((source) => source.id));
}

export async function buildProductPayload() {
  const source = (raw) => ({
    id: raw.id,
    label: raw.label,
    url: sourceUrl(raw.slug),
    specificationKey: raw.specificationKey ?? "ضخامت",
    groupingLabel: raw.groupingLabel ?? "کارخانه",
    detailKeys: productDetailKeys,
  });

  const catalogs = productCatalogs.map((catalog) => ({
    ...catalog,
    sources: catalog.sources.map(source),
  }));

  const fetched = await fetchCategories(
    catalogs.flatMap((catalog) => catalog.sources),
  );
  const categoriesById = new Map(
    fetched.map((category) => [category.id, category]),
  );

  const payload = {
    fetchedAt: new Date().toISOString(),
    ...SOURCE_ENVELOPE,
    catalogs: catalogs.map((catalog) => ({
      id: catalog.id,
      label: catalog.label,
      initialCategoryId: catalog.initialCategoryId,
      categories: catalog.sources.map((item) => categoriesById.get(item.id)),
    })),
  };
  validateProductPricePayload(payload, {
    expectedCatalogs: catalogs.map((catalog) => ({
      id: catalog.id,
      categoryIds: catalog.sources.map((item) => item.id),
    })),
  });
  return payload;
}

/** Fetch and validate all three datasets. Throws on the first failure. */
export async function buildAllPayloads() {
  const [rebar, beam, product] = await Promise.all([
    buildRebarPayload(),
    buildBeamPayload(),
    buildProductPayload(),
  ]);
  return { rebar, beam, product };
}
