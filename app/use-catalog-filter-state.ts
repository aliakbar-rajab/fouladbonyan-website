import { useMemo, useState } from "react";
import { getCategoryPricingState } from "./catalog-behavior.mjs";
import {
  INITIAL_FACTORY_COUNT,
  type CatalogViewRequest,
  type GroupCatalog,
} from "./catalog-types";

export function useCatalogFilterState(
  catalog: GroupCatalog,
  requestedView?: CatalogViewRequest,
) {
  const initialCategory =
    catalog.categories.find(
      (category) => category.id === catalog.initialCategoryId,
    ) ?? catalog.categories[0];

  if (!initialCategory) {
    throw new Error(`داده قیمت ${catalog.label} در دسترس نیست.`);
  }

  const [categoryId, setCategoryId] = useState(
    requestedView?.categoryId ?? initialCategory.id,
  );
  const [factoryFilter, setFactoryFilter] = useState(
    requestedView?.factory ?? "",
  );
  const [sizeFilter, setSizeFilter] = useState(requestedView?.size ?? "");
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    () => new Set(),
  );
  const [showAllFactories, setShowAllFactories] = useState(false);

  const category =
    catalog.categories.find((item) => item.id === categoryId) ??
    initialCategory;

  const filteredFactories = useMemo(
    () =>
      category.factories
        .filter((factory) => !factoryFilter || factory.name === factoryFilter)
        .map((factory) => ({
          ...factory,
          rows: factory.rows.filter(
            (row) => !sizeFilter || row.size === sizeFilter,
          ),
        }))
        .filter((factory) => factory.rows.length > 0),
    [category, factoryFilter, sizeFilter],
  );

  const collapsedFactories = Math.max(
    filteredFactories.length - INITIAL_FACTORY_COUNT,
    0,
  );
  const activeFilterCount =
    Number(Boolean(factoryFilter)) + Number(Boolean(sizeFilter));

  const pricingState = useMemo(
    () => getCategoryPricingState(category),
    [category],
  );

  const changeCategory = (id: string) => {
    setCategoryId(id);
    setFactoryFilter("");
    setSizeFilter("");
    setExpandedRows(new Set());
    setShowAllFactories(false);
  };

  const clearFilters = () => {
    setFactoryFilter("");
    setSizeFilter("");
    setShowAllFactories(false);
  };

  const toggleRow = (rowId: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  return {
    category,
    categoryId,
    factoryFilter,
    sizeFilter,
    taxIncluded,
    expandedRows,
    showAllFactories,
    filteredFactories,
    collapsedFactories,
    activeFilterCount,
    pricingState,
    setFactoryFilter,
    setSizeFilter,
    setTaxIncluded,
    setShowAllFactories,
    changeCategory,
    clearFilters,
    toggleRow,
  };
}
