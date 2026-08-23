export type ProductCatalogId =
  | "sheet"
  | "profile"
  | "pipe"
  | "angle"
  | "channel"
  | "wire";

export type ProductGroupId = "rebar" | "beam" | ProductCatalogId;

/**
 * Shared contract for validated catalog snapshots and the view requests that
 * select their rows. Keep this free of React so loaders, quote estimates, and
 * catalog presentation can evolve independently.
 */
export type CatalogSpecification = {
  label: string;
  value: string;
};

export type CatalogRow = {
  id: number;
  title: string;
  size: string;
  specification?: string;
  standard: string;
  grade: string;
  branchLength: string;
  form: string;
  approximateWeight: string;
  delivery: string;
  unit: string;
  factory: string;
  price: number | null;
  percent: number;
  status: string;
  updatedAt: number;
  updatedDate: string;
  specifications?: CatalogSpecification[];
};

export type CatalogFactory = {
  name: string;
  updatedAt: number;
  updatedDate: string;
  rows: CatalogRow[];
};

export type CatalogCategory = {
  id: string;
  label: string;
  groupingLabel: string;
  specificationLabel: string;
  sourceTitle: string;
  sourceUrl: string;
  summary: {
    date: string;
    min: number;
    max: number;
    average: number;
    percent: number;
    status: string;
  };
  filters: {
    sizes: string[];
    factories: string[];
  };
  factories: CatalogFactory[];
};

export type GroupCatalog = {
  id: ProductGroupId;
  label: string;
  initialCategoryId: string;
  fetchedAt: string;
  sourceName: string;
  sourceHome: string;
  taxRate: number;
  categories: CatalogCategory[];
};

export type CatalogSnapshot = {
  fetchedAt: string;
  sourceName: string;
  sourceHome: string;
  taxRate: number;
  catalogs: GroupCatalog[];
};

/** @deprecated Use CatalogSnapshot */
export type CatalogPriceData = CatalogSnapshot;

export type CatalogViewRequest = {
  requestId: number;
  categoryId?: string;
  factory?: string;
  size?: string;
};

export const INITIAL_FACTORY_COUNT = 6;

