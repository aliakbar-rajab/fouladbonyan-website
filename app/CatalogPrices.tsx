import {
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  INITIAL_FACTORY_COUNT,
  type CatalogViewRequest,
} from "./catalog-types";
import {
  getCategoryById,
  subcategoryHref,
  type ProductGroupId,
} from "./category-meta";
import { loadGroupCatalog, type GroupCatalog } from "./catalog-reader";
import { RebarWeightCalculator } from "./RebarWeightCalculator";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";
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
  const factoryListId = `${baseId}-factory-list`;

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
            catalog={catalog}
            category={category}
            factoryFilter={factoryFilter}
            sizeFilter={sizeFilter}
            activeFilterCount={activeFilterCount}
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
