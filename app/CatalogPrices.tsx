import {
  useId,
  type ReactNode,
} from "react";
import type { CatalogViewRequest } from "./catalog-types";
import {
  getCategoryById,
  subcategoryHref,
  type ProductGroupId,
} from "./category-meta";
import { loadGroupCatalog, type GroupCatalog } from "./catalog-reader";
import { RebarWeightCalculator } from "./RebarWeightCalculator";
import { CatalogLoadMessage } from "./site-ui";
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
    clearFilters,
    toggleRow,
  } = useCatalogFilterState(catalog, requestedView);

  const fetchedDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(new Date(catalog.fetchedAt));

  return (
    <div className="rebar-prices">
      <nav
        className={`rebar-kind-tabs ${tabClassNames[catalog.id] ?? ""}`.trim()}
        aria-label={`نوع ${catalog.label}`}
      >
        {catalog.categories.map((item) => (
          <a
            href={subcategoryHref(catalog.id, item.id)}
            aria-current={item.id === category.id ? "page" : undefined}
            key={item.id}
          >
            {`قیمت ${item.label}`}
          </a>
        ))}
      </nav>

      <div>
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

function BeamGuideSidebar() {
  return (
    <section className="calculator-card beam-guide-card" aria-label="راهنماهای فنی تیرآهن">
      <div className="beam-guide-card-header">
        <span aria-hidden="true">📊</span>
        <strong>راهنماهای فنی تیرآهن</strong>
      </div>
      <div className="beam-guide-card-links">
        <a href="/guide/beam-weight-chart/">جدول وزن تیرآهن IPE به تفکیک کارخانه</a>
        <a href="/guide/ipe-vs-hash-beam/">راهنمای تفاوت تیرآهن IPE و هاش</a>
      </div>
    </section>
  );
}

/** Product-specific sidebar tools, by group. */
const sidebarExtras: Partial<Record<ProductGroupId, ReactNode>> = {
  rebar: <RebarWeightCalculator />,
  beam: <BeamGuideSidebar />,
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
