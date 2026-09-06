import { useMemo, useState } from "react";
import { categoryPricingState } from "./catalog-pricing.mjs";
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

  /*
   * Derived, not state: the category a catalog is showing is decided by the
   * route (or by the view a search asked for), and the tabs that change it are
   * links that navigate. Holding it in state is what once let the table move
   * to another category while the page around it still described the one in
   * the URL.
   */
  const categoryId = requestedView?.categoryId ?? initialCategory.id;

  const category =
    catalog.categories.find((item) => item.id === categoryId) ??
    initialCategory;

  /*
   * A requested filter is adopted only when this category actually offers it.
   *
   * `?factory=ذوب آهن` is a valid link for /rebar/ribbed/ and meaningless on
   * /rebar/simple/, where no such factory sells. Held as filter state anyway,
   * it emptied the table ("برای این فیلتر قیمتی پیدا نشد") and put ۱ on the
   * active-filter badge, while the <select> beside it displayed "همه
   * کارخانه‌ها" -- a <select> falls back to its first option when no <option>
   * matches its value. The page contradicted itself and gave no way to see
   * which filter was to blame. Ignoring the parameter shows the full catalog,
   * which is what a reader following a stale link is looking for.
   */
  const offeredFilter = (offered: readonly string[], requested?: string) =>
    requested && offered.includes(requested) ? requested : "";

  const [factoryFilter, setFactoryFilter] = useState(() =>
    offeredFilter(category.filters.factories, requestedView?.factory),
  );
  const [sizeFilter, setSizeFilter] = useState(() =>
    offeredFilter(category.filters.sizes, requestedView?.size),
  );
  const [taxIncluded, setTaxIncluded] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(
    () => new Set(),
  );
  const [showAllFactories, setShowAllFactories] = useState(false);

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
    () => categoryPricingState(category),
    [category],
  );

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
    clearFilters,
    toggleRow,
  };
}
