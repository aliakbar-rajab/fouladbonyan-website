import {
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { CatalogViewRequest } from "./catalog-types";
import { getCategoryById, type ProductGroupId } from "./category-meta";
import {
  catalogPresentation,
  type CatalogPresentation,
} from "./catalog-presentation";
import { loadGroupCatalog, type GroupCatalog } from "./group-catalog";
import { RebarWeightCalculator } from "./RebarWeightCalculator";
import { CatalogLoadMessage } from "./site-ui";
import { nextRovingIndex } from "./roving-tabs";
import { useCatalogData } from "./use-catalog-data";
import { useCatalogFilterState } from "./use-catalog-filter-state";
import { CatalogSummaryBanner } from "./CatalogSummaryBanner";
import { FactoryPriceCardList } from "./FactoryPriceCardList";
import { CatalogFilterSidebar } from "./CatalogFilterSidebar";

/**
 * The price table for one product group's catalog: category tabs, the summary,
 * the factory cards, and the filter sidebar.
 *
 * It renders any GroupCatalog. Product-specific tools go in `sidebarExtra` so
 * no one group's feature lands in here.
 */
export function PriceCatalog({
  catalog,
  presentation,
  phoneHref,
  requestedView,
  sidebarExtra,
}: {
  catalog: GroupCatalog;
  presentation: CatalogPresentation;
  phoneHref: string;
  requestedView?: CatalogViewRequest;
  sidebarExtra?: ReactNode;
}) {
  const factorySelectId = useId();
  const sizeSelectId = useId();
  const factoryListId = useId().replaceAll(":", "");
  const tabsId = useId().replaceAll(":", "");
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
    changeCategory(catalog.categories[targetIndex].id);
    categoryTabRefs.current[targetIndex]?.focus();
  };

  return (
    <div className="rebar-prices">
      <div
        className={`rebar-kind-tabs ${presentation.tabClassName ?? ""}`.trim()}
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
      presentation={catalogPresentation(groupId, state.data.categories)}
      phoneHref={phoneHref}
      requestedView={requestedView}
      sidebarExtra={sidebarExtras[groupId]}
    />
  );
}

