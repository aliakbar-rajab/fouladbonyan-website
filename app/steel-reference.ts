/**
 * Derived reference data for the editorial guide pages (/guide/*).
 *
 * Everything exported here is computed from data the site already owns:
 *   - the standard rebar weight formula already shipped in catalog-behavior.mjs
 *     (and already exercised by the on-page weight calculator), and
 *   - the live price snapshots in app/data/*.json.
 *
 * Nothing here introduces a specification, standard, tolerance or weight that
 * cannot be read back out of those two sources. Where the catalogs do not
 * publish a value (for example a branch length for میلگرد ساده, or a weight for
 * هاش), the field stays null and the page renders nothing rather than guessing.
 *
 * The build script computes this once and embeds it as JSON, so the guide pages
 * hydrate against exactly the bytes they were prerendered from.
 */
import { calculateRebarWeight } from "./catalog-behavior.mjs";
import { toAsciiDigits } from "./site-logic.mjs";
import type {
  CatalogCategory,
  CatalogSnapshot,
  GroupCatalog,
} from "./catalog-types";


export type RebarWeightRow = {
  size: string;
  diameterMm: number;
  kgPerMeter: number;
  /** null when the catalog does not state a branch length for this product. */
  kgPerBranch: number | null;
  branchesPerTon: number | null;
};

export type RebarWeightTable = {
  id: string;
  label: string;
  href: string;
  branchLengthM: number | null;
  standards: string[];
  factoryCount: number;
  rows: RebarWeightRow[];
};

export type BeamWeightRow = {
  standard: string;
  size: string;
  branchLengthM: number;
  entries: { factory: string; weightKg: number }[];
  minKg: number;
  maxKg: number;
};

export type BeamWeightTable = {
  id: string;
  label: string;
  href: string;
  rows: BeamWeightRow[];
  /** Sub-catalogs that exist but publish no per-row weight (e.g. هاش). */
  missingWeightLabels: string[];
};

export type CatalogProfile = {
  groupId: string;
  groupLabel: string;
  groupHref: string;
  id: string;
  label: string;
  href: string;
  specificationLabel: string;
  standards: string[];
  grades: string[];
  sizes: string[];
  branchLengths: string[];
  units: string[];
  factoryCount: number;
  rowCount: number;
};

export type UnitUsage = {
  unit: string;
  rowCount: number;
  examples: { label: string; href: string }[];
};

export type GuideReference = {
  /**
   * The catalog's own Persian date for the snapshot these tables were derived
   * from, so the guides date themselves the same way the price tables do.
   */
  sourceDateLabel: string;
  /** ISO timestamp for the same snapshot, for `<time dateTime>` markup. */
  sourceDateIso: string;
  rebarTables: RebarWeightTable[];
  beamTable: BeamWeightTable;
  profiles: CatalogProfile[];
  unitUsage: UnitUsage[];
};

/**
 * The source publishes decimals with a Persian slash ("۷/۵") as often as with a
 * dot, and uses "-" for "not stated". Anything that is not a positive finite
 * number comes back null so the caller can drop the row.
 */
export function parseCatalogNumber(value: string | undefined): number | null {
  if (!value) return null;
  const normalised = toAsciiDigits(value).replace("/", ".").trim();
  const parsed = Number(normalised);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const uniqueSorted = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "fa"));

const bySizeValue = (a: string, b: string) => {
  const left = parseCatalogNumber(a);
  const right = parseCatalogNumber(b);
  if (left === null || right === null) return a.localeCompare(b, "fa");
  return left - right;
};

const allRows = (category: CatalogCategory) =>
  category.factories.flatMap((factory) => factory.rows);

/** The branch length the catalog itself states most often, or null. */
function dominantBranchLength(category: CatalogCategory): number | null {
  const counts = new Map<number, number>();
  for (const row of allRows(category)) {
    const length = parseCatalogNumber(row.branchLength);
    if (length === null) continue;
    counts.set(length, (counts.get(length) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [length, count] of counts) {
    if (count > bestCount) {
      best = length;
      bestCount = count;
    }
  }
  return best;
}

function buildProfile(
  category: CatalogCategory,
  groupId: string,
  groupLabel: string,
): CatalogProfile {
  const rows = allRows(category);
  return {
    groupId,
    groupLabel,
    groupHref: `/${groupId}/`,
    id: category.id,
    label: category.label,
    href: `/${groupId}/${category.id}/`,
    specificationLabel: category.specificationLabel,
    standards: uniqueSorted(rows.map((row) => row.standard)),
    grades: uniqueSorted(rows.map((row) => row.grade)),
    sizes: [...new Set(category.filters.sizes)].sort(bySizeValue),
    branchLengths: uniqueSorted(rows.map((row) => row.branchLength)),
    units: uniqueSorted(rows.map((row) => row.unit)),
    factoryCount: category.filters.factories.length,
    rowCount: rows.length,
  };
}

/**
 * وزن میلگرد is tabulated only for the two carbon-steel sub-catalogs. میلگرد
 * استیل and میلگرد آلیاژی are deliberately excluded: the d²/162 formula assumes
 * plain carbon steel density, and neither the alloy grades nor the stainless
 * grades in the catalog state a density this file could verify.
 */
const REBAR_WEIGHT_SUBCATALOGS = ["ribbed", "simple"] as const;

function buildRebarTables(rebar: {
  categories: CatalogCategory[];
}): RebarWeightTable[] {
  const tables: RebarWeightTable[] = [];

  for (const id of REBAR_WEIGHT_SUBCATALOGS) {
    const category = rebar.categories.find((item) => item.id === id);
    if (!category) continue;

    const branchLengthM = dominantBranchLength(category);
    const rows: RebarWeightRow[] = [];

    for (const size of [...new Set(category.filters.sizes)].sort(bySizeValue)) {
      const diameterMm = parseCatalogNumber(size);
      if (diameterMm === null) continue;

      const kgPerMeter = calculateRebarWeight(diameterMm, 1, 1);
      if (kgPerMeter === null) continue;

      const kgPerBranch =
        branchLengthM === null
          ? null
          : calculateRebarWeight(diameterMm, branchLengthM, 1);

      rows.push({
        size,
        diameterMm,
        kgPerMeter: round(kgPerMeter, 3),
        kgPerBranch: kgPerBranch === null ? null : round(kgPerBranch, 2),
        branchesPerTon:
          kgPerBranch === null ? null : Math.round(1000 / kgPerBranch),
      });
    }

    tables.push({
      id: category.id,
      label: category.label,
      href: `/rebar/${category.id}/`,
      branchLengthM,
      standards: uniqueSorted(allRows(category).map((row) => row.standard)),
      factoryCount: category.filters.factories.length,
      rows,
    });
  }

  return tables;
}

/**
 * تیرآهن weights are NOT computed. Each row in the beam catalog carries the
 * mill's own وزن تقریبی for a full branch, and those differ between mills for
 * the same nominal size — which is the fact worth publishing. Rows without a
 * stated weight are dropped instead of being filled in from a formula.
 */
function buildBeamTable(beam: {
  categories: CatalogCategory[];
}): BeamWeightTable {
  const category = beam.categories.find((item) => item.id === "beam");
  const missingWeightLabels = beam.categories
    .filter(
      (item) =>
        item.id !== "beam" &&
        allRows(item).every(
          (row) => parseCatalogNumber(row.approximateWeight) === null,
        ),
    )
    .map((item) => item.label);

  if (!category) {
    return {
      id: "beam",
      label: "تیرآهن",
      href: "/beam/beam/",
      rows: [],
      missingWeightLabels,
    };
  }

  const grouped = new Map<
    string,
    {
      standard: string;
      size: string;
      branchLengthM: number;
      byFactory: Map<string, number>;
    }
  >();

  for (const row of allRows(category)) {
    const weightKg = parseCatalogNumber(row.approximateWeight);
    const branchLengthM = parseCatalogNumber(row.branchLength);
    if (weightKg === null || branchLengthM === null || !row.size) continue;

    const key = `${row.standard}|${row.size}|${branchLengthM}`;
    const entry = grouped.get(key) ?? {
      standard: row.standard,
      size: row.size,
      branchLengthM,
      byFactory: new Map<string, number>(),
    };
    // A mill can appear on several rows (different delivery points / units) with
    // the same stated weight; keep one entry per mill.
    entry.byFactory.set(row.factory, weightKg);
    grouped.set(key, entry);
  }

  const rows: BeamWeightRow[] = [];
  for (const { standard, size, branchLengthM, byFactory } of grouped.values()) {
    const entries = [...byFactory.entries()]
      .map(([factory, weightKg]) => ({ factory, weightKg }))
      .sort((a, b) => a.weightKg - b.weightKg);
    if (!entries.length) continue;
    const weights = entries.map((entry) => entry.weightKg);
    rows.push({
      standard,
      size,
      branchLengthM,
      entries,
      minKg: Math.min(...weights),
      maxKg: Math.max(...weights),
    });
  }

  rows.sort(
    (a, b) =>
      a.standard.localeCompare(b.standard, "fa") || bySizeValue(a.size, b.size),
  );

  return {
    id: category.id,
    label: category.label,
    href: `/beam/${category.id}/`,
    rows,
    missingWeightLabels,
  };
}

/**
 * Units with fewer than this many rows behind them are dropped: the upstream
 * feed occasionally contains a single mistyped unit string, and a guide that
 * lists it as a real selling unit would be wrong.
 */
const MIN_ROWS_PER_UNIT = 3;

function buildUnitUsage(
  entries: { profile: CatalogProfile; category: CatalogCategory }[],
): UnitUsage[] {
  const byUnit = new Map<
    string,
    { rowCount: number; sources: Map<string, { count: number; href: string }> }
  >();

  for (const { profile, category } of entries) {
    for (const row of allRows(category)) {
      if (!row.unit) continue;
      const bucket = byUnit.get(row.unit) ?? {
        rowCount: 0,
        sources: new Map<string, { count: number; href: string }>(),
      };
      bucket.rowCount += 1;
      const source = bucket.sources.get(profile.label) ?? {
        count: 0,
        href: profile.href,
      };
      source.count += 1;
      bucket.sources.set(profile.label, source);
      byUnit.set(row.unit, bucket);
    }
  }

  return [...byUnit.entries()]
    .filter(([, bucket]) => bucket.rowCount >= MIN_ROWS_PER_UNIT)
    .sort(([, a], [, b]) => b.rowCount - a.rowCount)
    .map(([unit, bucket]) => ({
      unit,
      rowCount: bucket.rowCount,
      examples: [...bucket.sources.entries()]
        .sort(([, a], [, b]) => b.count - a.count)
        .slice(0, 4)
        .map(([label, source]) => ({ label, href: source.href })),
    }));
}

function normalizeSnapshotInput(
  first: CatalogSnapshot | { categories: CatalogCategory[] },
  second?: { categories: CatalogCategory[] },
  third?: { catalogs: GroupCatalog[] },
): CatalogSnapshot {
  if (first && "catalogs" in first && Array.isArray(first.catalogs)) {
    return first as CatalogSnapshot;
  }
  const rebarCategories = (first as { categories?: CatalogCategory[] })?.categories ?? [];
  const beamCategories = (second as { categories?: CatalogCategory[] })?.categories ?? [];
  const productCatalogs = (third as { catalogs?: GroupCatalog[] })?.catalogs ?? [];

  return {
    fetchedAt:
      (first as { fetchedAt?: string })?.fetchedAt ||
      (second as { fetchedAt?: string })?.fetchedAt ||
      "",
    sourceName: (first as { sourceName?: string })?.sourceName || "فولاد ایرانیان",
    sourceHome:
      (first as { sourceHome?: string })?.sourceHome ||
      "https://www.fooladiranian.com/",
    taxRate: (first as { taxRate?: number })?.taxRate ?? 0.1,
    catalogs: [
      {
        id: "rebar",
        label: "میلگرد",
        initialCategoryId: "ribbed",
        fetchedAt: (first as { fetchedAt?: string })?.fetchedAt || "",
        sourceName: (first as { sourceName?: string })?.sourceName || "",
        sourceHome: (first as { sourceHome?: string })?.sourceHome || "",
        taxRate: (first as { taxRate?: number })?.taxRate ?? 0.1,
        categories: rebarCategories,
      },
      {
        id: "beam",
        label: "تیرآهن",
        initialCategoryId: "beam",
        fetchedAt: (second as { fetchedAt?: string })?.fetchedAt || "",
        sourceName: (second as { sourceName?: string })?.sourceName || "",
        sourceHome: (second as { sourceHome?: string })?.sourceHome || "",
        taxRate: (second as { taxRate?: number })?.taxRate ?? 0.1,
        categories: beamCategories,
      },
      ...productCatalogs,
    ],
  };
}

export function buildGuideReference(
  snapshotOrRebar: CatalogSnapshot | { categories: CatalogCategory[] },
  maybeBeam?: { categories: CatalogCategory[] },
  maybeProducts?: { catalogs: GroupCatalog[] },
): GuideReference {
  const snapshot = normalizeSnapshotInput(
    snapshotOrRebar,
    maybeBeam,
    maybeProducts,
  );
  const rebarCatalog = snapshot.catalogs.find((c) => c.id === "rebar");
  const beamCatalog = snapshot.catalogs.find((c) => c.id === "beam");

  const entries: { profile: CatalogProfile; category: CatalogCategory }[] = [];

  for (const catalog of snapshot.catalogs) {
    for (const category of catalog.categories) {
      entries.push({
        profile: buildProfile(category, catalog.id, catalog.label),
        category,
      });
    }
  }

  const allCategories = snapshot.catalogs.flatMap((c) => c.categories);
  const sourceDateLabel =
    allCategories.map((category) => category.summary.date).find(Boolean) ?? "";
  const sourceDateIso = snapshot.fetchedAt;

  return {
    sourceDateLabel,
    sourceDateIso,
    rebarTables: rebarCatalog ? buildRebarTables(rebarCatalog) : [],
    beamTable: beamCatalog
      ? buildBeamTable(beamCatalog)
      : {
          id: "beam",
          label: "تیرآهن",
          href: "/beam/beam/",
          rows: [],
          missingWeightLabels: [],
        },
    profiles: entries
      .filter(
        (entry) =>
          entry.profile.groupId === "rebar" || entry.profile.groupId === "beam",
      )
      .map((entry) => entry.profile),
    unitUsage: buildUnitUsage(entries),
  };
}


