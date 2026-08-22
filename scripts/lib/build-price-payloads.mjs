import {
  rebarSources,
  beamSources,
  productCatalogs,
  productDetailKeys,
} from "../price-catalog-config.mjs";
import {
  SOURCE_ENVELOPE,
  fetchCategoriesWithDiagnostics,
  sourceUrl,
} from "./catalog-source.mjs";

import {
  validateCatalogPriceData,
  validateProductPricePayload,
} from "../../app/catalog-validation.mjs";

// The one place that assembles a full, validated rebar/beam/product payload
// from the live source. Used by the local manual scripts
// (scripts/fetch-*-prices.mjs, which write the result to app/data/*.json)
// and by scripts/refresh-and-publish.mjs (which the scheduled GitHub Actions
// relay runs, POSTing the result to the Cloudflare Worker instead).
export async function buildCatalogPayload(sources, expectedCategoryIds, options = {}) {
  const {
    fallbackPayload,
    fallbackCategories = fallbackPayload?.categories ?? [],
    fetchImpl,
    attempts,
    limit,
    onWarning,
  } = options;

  const resolved = sources.map((source) => ({
    ...source,
    url: sourceUrl(source.slug),
  }));

  const { categories, diagnostics } = await fetchCategoriesWithDiagnostics(resolved, {
    fallbackCategories,
    fetchImpl,
    attempts,
    limit,
    onWarning,
  });

  const payload = {
    fetchedAt: new Date().toISOString(),
    ...SOURCE_ENVELOPE,
    categories,
  };

  validateCatalogPriceData(payload, { expectedCategoryIds });
  return { payload, diagnostics };
}

export async function buildRebarPayload(options = {}) {
  const { payload } = await buildCatalogPayload(
    rebarSources,
    rebarSources.map((source) => source.id),
    options,
  );
  return payload;
}

export async function buildBeamPayload(options = {}) {
  const { payload } = await buildCatalogPayload(
    beamSources,
    beamSources.map((source) => source.id),
    options,
  );
  return payload;
}

async function buildProductPayloadInternal(options = {}) {
  const {
    fallbackPayload,
    fallbackCategories = fallbackPayload?.catalogs?.flatMap(
      (catalog) => catalog.categories ?? [],
    ) ?? [],
    fetchImpl,
    attempts,
    limit,
    onWarning,
  } = options;

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

  const allSources = catalogs.flatMap((catalog) => catalog.sources);
  const { categories: fetched, diagnostics } = await fetchCategoriesWithDiagnostics(allSources, {
    fallbackCategories,
    fetchImpl,
    attempts,
    limit,
    onWarning,
  });

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

  return { payload, diagnostics };
}

export async function buildProductPayload(options = {}) {
  const { payload } = await buildProductPayloadInternal(options);
  return payload;
}

/** Fetch and validate all three datasets with fallback support. */
export async function buildAllPayloads({
  fallbacks = {},
  fetchImpl,
  attempts,
  limit,
  onWarning,
} = {}) {
  const [rebarRes, beamRes, productRes] = await Promise.all([
    buildCatalogPayload(rebarSources, rebarSources.map((s) => s.id), {
      fallbackPayload: fallbacks.rebar,
      fetchImpl,
      attempts,
      limit,
      onWarning,
    }),
    buildCatalogPayload(beamSources, beamSources.map((s) => s.id), {
      fallbackPayload: fallbacks.beam,
      fetchImpl,
      attempts,
      limit,
      onWarning,
    }),
    buildProductPayloadInternal({
      fallbackPayload: fallbacks.product,
      fetchImpl,
      attempts,
      limit,
      onWarning,
    }),
  ]);

  const rebar = rebarRes.payload;
  const beam = beamRes.payload;
  const product = productRes.payload;

  const rebarDiag = rebarRes.diagnostics ?? { total: 0, freshCount: 0, fallbackCount: 0, warnings: [] };
  const beamDiag = beamRes.diagnostics ?? { total: 0, freshCount: 0, fallbackCount: 0, warnings: [] };
  const productDiag = productRes.diagnostics ?? { total: 0, freshCount: 0, fallbackCount: 0, warnings: [] };

  const diagnostics = {
    totalCategories: rebarDiag.total + beamDiag.total + productDiag.total,
    freshCategories: rebarDiag.freshCount + beamDiag.freshCount + productDiag.freshCount,
    fallbackCategories: rebarDiag.fallbackCount + beamDiag.fallbackCount + productDiag.fallbackCount,
    warnings: [
      ...(rebarDiag.warnings ?? []),
      ...(beamDiag.warnings ?? []),
      ...(productDiag.warnings ?? []),
    ],
    datasets: {
      rebar: rebarDiag,
      beam: beamDiag,
      product: productDiag,
    },
  };

  return { rebar, beam, product, diagnostics };
}



