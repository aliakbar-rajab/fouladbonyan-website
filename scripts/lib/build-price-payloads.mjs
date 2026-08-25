import {
  allCatalogConfigs,
  productDetailKeys,
} from "../price-catalog-config.mjs";
import {
  SOURCE_ENVELOPE,
  fetchCategoriesWithDiagnostics,
  sourceUrl,
} from "./catalog-source.mjs";
import { validateCatalogSnapshot } from "../../app/catalog-validation.mjs";

function resolveSource(raw) {
  return {
    id: raw.id,
    label: raw.label,
    slug: raw.slug,
    url: sourceUrl(raw.slug),
    minimumItems: raw.minimumItems,
    deriveSize: raw.deriveSize,
    specificationKey:
      raw.specificationKey ??
      (raw.groupingLabel === "گرید" ? "گرید" : "ضخامت"),
    specificationLabel: raw.specificationLabel,
    groupingLabel: raw.groupingLabel ?? "کارخانه",
    detailKeys: raw.detailKeys ?? productDetailKeys,
  };
}

/**
 * The single canonical place that assembles a full, validated CatalogSnapshot
 * from the live market source. Used by both local fetch scripts
 * (scripts/fetch-catalog-prices.mjs) and the scheduled relay
 * (scripts/refresh-and-publish.mjs).
 */
export async function buildCatalogSnapshot(options = {}) {
  const {
    fallbackSnapshot,
    fallbackCategories = fallbackSnapshot?.catalogs?.flatMap(
      (catalog) => catalog.categories ?? [],
    ) ?? [],
    fetchImpl,
    attempts,
    limit,
    onWarning,
  } = options;

  const catalogs = allCatalogConfigs.map((catalog) => ({
    id: catalog.id,
    label: catalog.label,
    initialCategoryId: catalog.initialCategoryId,
    sources: catalog.sources.map(resolveSource),
  }));

  const allSources = catalogs.flatMap((catalog) => catalog.sources);
  const { categories: fetched, diagnostics } =
    await fetchCategoriesWithDiagnostics(allSources, {
      fallbackCategories,
      fetchImpl,
      attempts,
      limit,
      onWarning,
    });

  const categoriesById = new Map(
    fetched.map((category) => [category.id, category]),
  );

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    ...SOURCE_ENVELOPE,
    catalogs: catalogs.map((catalog) => ({
      id: catalog.id,
      label: catalog.label,
      initialCategoryId: catalog.initialCategoryId,
      categories: catalog.sources.map((item) => categoriesById.get(item.id)),
    })),
  };

  validateCatalogSnapshot(snapshot, {
    expectedCatalogs: catalogs.map((catalog) => ({
      id: catalog.id,
      categoryIds: catalog.sources.map((item) => item.id),
    })),
  });

  const enrichedDiagnostics = {
    totalCategories: diagnostics.total,
    freshCategories: diagnostics.freshCount,
    fallbackCategories: diagnostics.fallbackCount,
    warnings: diagnostics.warnings ?? [],
  };

  return { snapshot, diagnostics: enrichedDiagnostics };
}




