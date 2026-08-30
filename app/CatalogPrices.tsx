import {
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { CatalogViewRequest } from "./catalog-types";
import { getCategoryById, type ProductGroupId } from "./category-meta";
import { loadGroupCatalog, type GroupCatalog } from "./catalog-reader";
import { RebarWeightCalculator } from "./RebarWeightCalculator";
import { CatalogLoadMessage } from "./site-ui";
import { nextRovingIndex } from "./catalog-utils";
import { useCatalogData } from "./use-catalog-data";
import { useCatalogFilterState } from "./use-catalog-filter-state";
import { CatalogSummaryBanner } from "./CatalogSummaryBanner";
import { FactoryPriceCardList } from "./FactoryPriceCardList";
import { CatalogFilterSidebar } from "./CatalogFilterSidebar";

const tabClassNames: Partial<Record<ProductGroupId, string>> = {
  beam: "beam-kind-tabs",
  sheet: "product-kind-tabs",
  profile: "product-kind-tabs",
  pipe: "product-kind-tabs",
  angle: "product-kind-tabs",
  channel: "product-kind-tabs",
  wire: "product-kind-tabs",
};

/**
 * The price table for one product group's catalog: category tabs, the summary,
 * the factory cards, and the filter sidebar.
 *
 * It renders any GroupCatalog. Product-specific tools go in `sidebarExtra` so
 * no one group's feature lands in here.
 */
export function PriceCatalog({
  catalog,
  phoneHref,
  requestedView,
  sidebarExtra,
}: {
  catalog: GroupCatalog;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
  sidebarExtra?: ReactNode;
}) {
  const baseId = useId();
  const factorySelectId = `${baseId}-factory-select`;
  const sizeSelectId = `${baseId}-size-select`;
  const factoryListId = `${baseId}-factory-list`;
  const tabsId = `${baseId}-tabs`;
  const categoryTabRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);

  const {
    category,
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
  } = useCatalogFilterState(catalog, requestedView);

  const fetchedDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(catalog.fetchedAt));

  /*
   * Roving-tabindex focus only, the same contract as the home product tabs in
   * App.tsx: these tabs are real links, so arrow keys move focus like
   * Tab/Shift+Tab and the browser's own Enter/click activation of the
   * now-focused link commits the category. Committing on keydown would switch
   * the visible catalog without the URL, <title> or metadata following it.
   */
  const moveCategoryTabFocus = (
    event: ReactKeyboardEvent<HTMLElement>,
    currentIndex: number,
  ) => {
    const targetIndex = nextRovingIndex(
      event.key,
      currentIndex,
      catalog.categories.length,
    );
    if (targetIndex === null) return;

    event.preventDefault();
    categoryTabRefs.current[targetIndex]?.focus();
  };

  return (
    <div className="rebar-prices">
      <div
        className={`rebar-kind-tabs ${tabClassNames[catalog.id] ?? ""}`.trim()}
        role="tablist"
        aria-label={`نوع ${catalog.label}`}
      >
        {catalog.categories.map((item, index) => (
          <a
            href={`/${catalog.id}/${item.id}/`}
            role="tab"
            id={`${tabsId}-tab-${item.id}`}
            aria-selected={item.id === category.id}
            aria-controls={`${tabsId}-panel-${item.id}`}
            tabIndex={item.id === category.id ? 0 : -1}
            key={item.id}
            ref={(node) => {
              categoryTabRefs.current[index] = node;
            }}
            onClick={(event) => {
              event.preventDefault();
              changeCategory(item.id);
            }}
            onKeyDown={(event) => moveCategoryTabFocus(event, index)}
          >
            {`قیمت ${item.label}`}
          </a>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`${tabsId}-panel-${category.id}`}
        aria-labelledby={`${tabsId}-tab-${category.id}`}
        tabIndex={0}
      >
        <div className="rebar-layout">
          <div className="rebar-main">
            <CatalogSummaryBanner
              category={category}
              fetchedAt={catalog.fetchedAt}
              taxIncluded={taxIncluded}
              taxRate={catalog.taxRate}
              pricingState={pricingState}
            />

            <FactoryPriceCardList
              catalogId={catalog.id}
              category={category}
              filteredFactories={filteredFactories}
              collapsedFactories={collapsedFactories}
              showAllFactories={showAllFactories}
              factoryListId={factoryListId}
              taxIncluded={taxIncluded}
              taxRate={catalog.taxRate}
              expandedRows={expandedRows}
              onToggleTax={() => setTaxIncluded((current) => !current)}
              onToggleRow={toggleRow}
              onToggleShowAllFactories={() =>
                setShowAllFactories((current) => !current)
              }
              onClearFilters={clearFilters}
            />
          </div>

          <CatalogFilterSidebar
            catalogLabel={catalog.label}
            category={category}
            factoryFilter={factoryFilter}
            sizeFilter={sizeFilter}
            activeFilterCount={activeFilterCount}
            factorySelectId={factorySelectId}
            sizeSelectId={sizeSelectId}
            fetchedDate={fetchedDate}
            sourceName={catalog.sourceName}
            phoneHref={phoneHref}
            sidebarExtra={sidebarExtra}
            onFactoryFilterChange={(val) => {
              setFactoryFilter(val);
              setShowAllFactories(false);
            }}
            onSizeFilterChange={(val) => {
              setSizeFilter(val);
              setShowAllFactories(false);
            }}
            onClearFilters={clearFilters}
          />
        </div>
      </div>
    </div>
  );
}

/** Product-specific sidebar tools, by group. */
const sidebarExtras: Partial<Record<ProductGroupId, ReactNode>> = {
  rebar: <RebarWeightCalculator />,
};

export default function CatalogPrices({
  groupId,
  phoneHref,
  requestedView,
}: {
  groupId: ProductGroupId;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
}) {
  const state = useCatalogData(loadGroupCatalog, groupId);

  if (state.status !== "ready") {
    return (
      <CatalogLoadMessage
        status={state.status}
        subject={`قیمت ${getCategoryById(groupId)?.label ?? "این گروه"}`}
      />
    );
  }

  return (
    <PriceCatalog
      catalog={state.data}
      phoneHref={phoneHref}
      requestedView={requestedView}
      sidebarExtra={sidebarExtras[groupId]}
    />
  );
}

