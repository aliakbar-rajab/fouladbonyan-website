import {
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import {
  createRetryableLoader,
  initialCategoryIdOf,
  loadAllGroupCatalogs,
  type GroupCatalog,
} from "./catalog-reader";
import type { CatalogViewRequest } from "./catalog-types";
import { isProductGroupId } from "./site-route";
import { filterProductGroups } from "./site-logic.mjs";

// ---------------------------------------------------------------------------
// 1. SEARCH INDEXING & PROJECTION
// ---------------------------------------------------------------------------

export type CatalogSearchRow = {
  product: string;
  origin: string;
  unit: string;
  categoryId: string;
  factory: string;
  size: string;
  searchText: string;
};

export type CatalogSearchGroup = ProductGroup & {
  rows: CatalogSearchRow[];
};

/**
 * Project and index searchable rows from live group catalogs.
 */
export function buildCatalogSearchGroups(
  baseGroups: readonly ProductGroup[],
  catalogs: GroupCatalog[],
): CatalogSearchGroup[] {
  const categoriesByGroup = new Map(
    catalogs.map((catalog) => [catalog.id, catalog.categories]),
  );

  return baseGroups.map((group) => ({
    ...group,
    rows: (categoriesByGroup.get(group.id) ?? []).flatMap((category) =>
      category.factories.flatMap((factory) =>
        factory.rows.map((row) => ({
          product: row.title,
          origin: row.factory || factory.name || row.delivery || "—",
          unit: row.unit || "—",
          categoryId: category.id,
          factory: factory.name,
          size: row.size,
          searchText: [
            category.label,
            category.sourceTitle,
            row.title,
            row.size,
            row.specification,
            row.standard,
            row.grade,
            row.branchLength,
            row.form,
            row.delivery,
            row.unit,
            row.factory,
            factory.name,
            ...(row.specifications ?? []).flatMap((item) => [
              item.label,
              item.value,
            ]),
          ]
            .filter(Boolean)
            .join(" "),
        })),
      ),
    ),
  }));
}

export const loadCatalogSearchGroups = createRetryableLoader<CatalogSearchGroup[]>(
  () =>
    loadAllGroupCatalogs().then((catalogs) =>
      buildCatalogSearchGroups(productGroups, catalogs),
    ),
);

// ---------------------------------------------------------------------------
// 2. PURE DOMAIN EVALUATION
// ---------------------------------------------------------------------------

export type SearchExecutionResult = {
  matchedGroups: ProductGroup[];
  selectedGroupId: ProductGroupId;
  suggestedViewRequest?: Omit<CatalogViewRequest, "requestId">;
  statusMessage: string;
};

/**
 * Pure evaluation of a search query against indexed product groups.
 *
 * `query` is always non-empty: submitSearch answers an empty one by returning
 * the workspace to the view its route describes, which is a different answer
 * from "everything matched" and is not this function's to give.
 */
export function evaluateCatalogSearch(
  query: string,
  groups: CatalogSearchGroup[],
): SearchExecutionResult {
  const trimmed = query.trim();
  const results = filterProductGroups(groups, trimmed);

  if (!results.length) {
    return {
      matchedGroups: [],
      selectedGroupId: productGroups[0].id,
      statusMessage: `نتیجه‌ای برای «${trimmed}» پیدا نشد.`,
    };
  }

  const totalCount = results.reduce((sum, group) => sum + group.rows.length, 0);
  const firstGroup = results[0];
  const selectedGroupId = isProductGroupId(firstGroup.id)
    ? firstGroup.id
    : productGroups[0].id;
  const firstRow = firstGroup.rows[0];

  return {
    matchedGroups: results,
    selectedGroupId,
    suggestedViewRequest: firstRow
      ? {
          categoryId: firstRow.categoryId,
          factory: firstRow.factory,
          size: firstRow.size,
        }
      : {
          categoryId: initialCategoryIdOf(selectedGroupId),
        },
    statusMessage: `${totalCount.toLocaleString("fa-IR")} نتیجه برای «${trimmed}» پیدا شد.`,
  };
}

export function priceSectionHeading(
  subcategoryLabel: string | undefined,
  categoryLabel: string | undefined,
): { title: string; description: string } {
  if (subcategoryLabel) {
    return {
      title: `جدول قیمت و مشخصات فنی ${subcategoryLabel}`,
      description: `قیمت روز و مشخصات فنی ${subcategoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  if (categoryLabel) {
    return {
      title: `جدول و مقایسه قیمت انواع ${categoryLabel}`,
      description: `قیمت روز و مشخصات فنی انواع ${categoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  return {
    title: "قیمت روز آهن‌آلات و مقاطع فولادی",
    description:
      "خلاصه قیمت روز همه دسته‌های فولادی بر اساس استعلام بازار. برای مشاهده مشخصات کامل روی هر گروه کلیک کنید.",
  };
}
