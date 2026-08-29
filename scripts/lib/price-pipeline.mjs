import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import {
  parsePersianNumber,
  toPersianDigits,
} from "../../app/persian-numbers.mjs";
import {
  deriveSummaryFromRows,
  validateCatalogSnapshot,
} from "../../app/catalog-validation.mjs";
import {
  allCatalogConfigs,
  productDetailKeys,
} from "../price-catalog-config.mjs";

/*
 * ===========================================================================
 * 1. SOURCE DEFINITIONS & NORMALIZATION
 * ===========================================================================
 */

const SOURCE_ENVELOPE = {
  sourceName: "فولاد ایرانیان",
  sourceHome: "https://www.fooladiranian.com/",
  taxRate: 0.1,
};

const SOURCE_ROOT = "https://www.fooladiranian.com/productlist/";

/** Build a source URL from a Persian slug, keeping hyphens unescaped. */
function sourceUrl(slug) {
  return new URL(
    `${encodeURIComponent(slug).replaceAll("%2D", "-")}/`,
    SOURCE_ROOT,
  ).href;
}

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tehran",
});

function metaValue(item, key) {
  const directValue = item[`meta-${key}`];
  if (directValue !== undefined && directValue !== null) {
    return String(directValue);
  }
  const meta = item.metas?.find((entry) => entry.title === key);
  return meta?.value !== undefined && meta?.value !== null
    ? String(meta.value)
    : "";
}

function formatPersianDate(unixTimestamp) {
  if (!unixTimestamp) return "";
  return persianDateFormatter
    .format(new Date(Number(unixTimestamp) * 1_000))
    .replace(/\p{Cf}/gu, "");
}

/** Numeric where both sides are numeric, Persian collation otherwise. */
function compareSizeValues(first, second) {
  const firstNumber = parsePersianNumber(first);
  const secondNumber = parsePersianNumber(second);
  if (firstNumber !== null && secondNumber !== null) {
    return firstNumber - secondNumber;
  }
  return String(first ?? "").localeCompare(String(second ?? ""), "fa");
}

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
 * Parse Next.js __NEXT_DATA__ from an HTML page into a structured category model.
 */
function parseCatalogPage(html, source) {
  const match = html.match(
    /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>(.*?)<\/script>/s,
  );
  if (!match) {
    throw new Error(`داده ساختاریافته در صفحه ${source.label} پیدا نشد.`);
  }

  let nextData;
  try {
    nextData = JSON.parse(match[1]);
  } catch (error) {
    throw new Error(
      `تجزیه JSON ساختاریافته صفحه ${source.label} ناموفق بود: ${error.message}`,
      { cause: error },
    );
  }

  const shopData = nextData?.props?.pageProps?.shopData;
  if (!shopData?.products || !shopData?.price_compare) {
    throw new Error(`ساختار داده صفحه ${source.label} معتبر نیست.`);
  }

  const factories = shopData.products
    .map((factoryGroup) => {
      const rows = (factoryGroup.productsitem ?? []).map((item) => ({
        id: Number(item.id),
        title: String(item.title ?? ""),
        size: source.deriveSize?.(item) ?? metaValue(item, "سایز"),
        ...(source.specificationKey
          ? { specification: metaValue(item, source.specificationKey) }
          : {}),
        standard: metaValue(item, "استاندارد"),
        grade: metaValue(item, "گرید"),
        branchLength: metaValue(item, "طول شاخه") || metaValue(item, "طول"),
        form: metaValue(item, "حالت"),
        approximateWeight: metaValue(item, "وزن تقریبی"),
        delivery: metaValue(item, "محل تحویل"),
        unit: metaValue(item, "واحد") || "کیلوگرم",
        factory:
          metaValue(item, "کارخانه") ||
          String(factoryGroup.title ?? item.factory ?? ""),
        ...(source.detailKeys
          ? {
              specifications: source.detailKeys
                .map((label) => ({ label, value: metaValue(item, label) }))
                .filter((entry) => entry.value),
            }
          : {}),
        price: Number(item.price) > 0 ? Number(item.price) : null,
        percent: Number(item.percent) || 0,
        status: String(item.status ?? "same"),
        updatedAt: Number(item.updated_at) || 0,
        updatedDate: formatPersianDate(item.updated_at),
      }));

      const latestUpdate = Math.max(0, ...rows.map((row) => row.updatedAt));
      return {
        name: String(factoryGroup.title ?? rows[0]?.factory ?? "سایر"),
        updatedAt: latestUpdate,
        updatedDate: formatPersianDate(latestUpdate),
        rows,
      };
    })
    .filter((factory) => factory.rows.length);

  const rows = factories.flatMap((factory) => factory.rows);
  if (rows.length < (source.minimumItems ?? 1)) {
    throw new Error(
      `تعداد ردیف‌های ${source.label} کمتر از حد انتظار است (${rows.length}).`,
    );
  }

  const compare = shopData.price_compare;
  return {
    id: source.id,
    label: source.label,
    groupingLabel: source.groupingLabel ?? "کارخانه",
    specificationLabel:
      source.specificationLabel ?? source.specificationKey ?? "استاندارد",
    sourceTitle: String(shopData.title ?? source.label),
    sourceUrl: source.url,
    summary: {
      date: toPersianDigits(String(compare.date ?? "")),
      ...deriveSummaryFromRows(rows),
      percent: Number(compare.percent) || 0,
      status: String(compare.status ?? "same"),
    },
    filters: {
      sizes: [...new Set(rows.map((row) => row.size).filter(Boolean))].sort(
        compareSizeValues,
      ),
      factories: factories.map((factory) => factory.name),
    },
    factories,
  };
}

/*
 * ===========================================================================
 * 2. RESILIENT FETCHING & CATEGORY FAULT ISOLATION
 * ===========================================================================
 */

async function fetchCategoryOnce(
  source,
  { timeoutMs = 25_000, fetchImpl = fetch } = {},
) {
  const response = await fetchImpl(source.url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "fa-IR,fa;q=0.9",
      "user-agent": "Bonyan-Foulad-Daria/1.0 (+https://fouladbonyan.com/)",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const error = new Error(`${source.label}: HTTP ${response.status}`);
    error.status = response.status;
    const retryAfterHeader = response.headers?.get?.("retry-after");
    if (retryAfterHeader) {
      const parsedSeconds = Number.parseInt(retryAfterHeader, 10);
      if (Number.isFinite(parsedSeconds) && parsedSeconds > 0) {
        error.retryAfterMs = parsedSeconds * 1000;
      }
    }
    throw error;
  }

  const html = await response.text();
  return parseCatalogPage(html, source);
}

async function fetchCategory(
  source,
  {
    attempts = 4,
    baseDelayMs = 800,
    maxDelayMs = 8_000,
    timeoutMs = 25_000,
    fetchImpl = fetch,
    onRetry = null,
  } = {},
) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchCategoryOnce(source, { timeoutMs, fetchImpl });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        let delayMs = Math.min(
          maxDelayMs,
          baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 300),
        );
        if (error.retryAfterMs && error.retryAfterMs > 0) {
          delayMs = Math.min(maxDelayMs, Math.max(delayMs, error.retryAfterMs));
        }

        const logMsg = `[تلاش مجدد ${attempt}/${attempts}] دریافت «${source.label}» با خطا مواجه شد (${error.message}). تلاش بعدی پس از ${delayMs}ms...`;
        if (onRetry) {
          onRetry({ source, attempt, attempts, delayMs, error, message: logMsg });
        } else {
          console.warn(logMsg);
        }
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
}

async function fetchCategoriesWithDiagnostics(sources, options = {}) {
  const {
    limit = 4,
    fallbackCategories = [],
    fetchImpl = fetch,
    attempts = 4,
    onWarning = null,
  } = options;

  const fallbackMap = new Map(
    (fallbackCategories ?? []).map((category) => [category?.id, category]),
  );

  const results = [];
  const warnings = [];

  for (let index = 0; index < sources.length; index += limit) {
    const batch = sources.slice(index, index + limit);
    const batchResults = await Promise.all(
      batch.map(async (source) => {
        try {
          const category = await fetchCategory(source, { attempts, fetchImpl });
          return { category, fresh: true };
        } catch (error) {
          const fallback = fallbackMap.get(source.id);
          if (fallback) {
            const warningMsg = `[ایزوله‌سازی خطا] دریافت دسته «${source.label}» (${source.id}) پس از ${attempts} تلاش ناموفق بود (${error.message}). از داده‌های معتبر قبلی استفاده شد.`;
            warnings.push({
              sourceId: source.id,
              sourceLabel: source.label,
              error: error.message,
              message: warningMsg,
            });
            if (onWarning) {
              onWarning(warningMsg, { source, error });
            } else {
              console.warn(warningMsg);
            }
            return {
              category: fallback,
              fresh: false,
              fallback: true,
              error: error.message,
            };
          }
          throw error;
        }
      }),
    );
    results.push(...batchResults);
  }

  const categories = results.map((item) => item.category);

  const diagnostics = {
    total: sources.length,
    freshCount: results.filter((r) => r.fresh).length,
    fallbackCount: results.filter((r) => r.fallback).length,
    warnings,
  };

  return { categories, diagnostics };
}

/*
 * ===========================================================================
 * 3. CANONICAL SNAPSHOT ASSEMBLY & SEMANTIC VALIDATION
 * ===========================================================================
 */

async function buildCatalogSnapshot(options = {}) {
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

/*
 * ===========================================================================
 * 4. STORAGE ADAPTERS (CLOUDFLARE WORKER & LOCAL DISK)
 * ===========================================================================
 */

/**
 * Post a fetched+validated payload set to Cloudflare Worker ingest endpoint.
 */
async function publishPayloads({
  endpoint,
  token,
  payloads,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`${endpoint}/ingest`, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payloads),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Cloudflare این داده را نپذیرفت (HTTP ${response.status}): ${body.error ?? JSON.stringify(body)}`,
    );
  }
  return body;
}

/**
 * Pull one dataset from Cloudflare Worker and validate before overwriting outputPath.
 */
async function pullDataset({
  endpoint,
  name,
  outputPath,
  validate,
  fetchImpl = fetch,
}) {
  try {
    const response = await fetchImpl(`${endpoint}/${name}.json`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    if (validate) validate(data);
    await writeFile(outputPath, `${JSON.stringify(data)}\n`);
    return { ok: true, fetchedAt: data.fetchedAt };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

/**
 * High-level operation: Fetch, validate, and publish live prices to Cloudflare Worker.
 */
export async function refreshAndPublishSnapshot({
  endpoint,
  token,
  fallbackSnapshot = null,
  fetchImpl = fetch,
  onWarning = null,
}) {
  const { snapshot, diagnostics } = await buildCatalogSnapshot({
    fallbackSnapshot,
    fetchImpl,
    onWarning,
  });

  const publishResult = await publishPayloads({
    endpoint,
    token,
    payloads: { snapshot, diagnostics },
    fetchImpl,
  });

  return { snapshot, diagnostics, publishResult };
}

/**
 * High-level operation: Pull snapshot from Cloudflare Worker during build and save to disk.
 */
export async function pullPriceSnapshot({
  endpoint,
  outputPath,
  fetchImpl = fetch,
}) {
  return pullDataset({
    endpoint,
    name: "catalog-prices",
    outputPath,
    validate: (data) =>
      validateCatalogSnapshot(data, {
        expectedCatalogs: allCatalogConfigs.map((catalog) => ({
          id: catalog.id,
          categoryIds: catalog.sources.map((source) => source.id),
        })),
      }),
    fetchImpl,
  });
}

/**
 * High-level operation: Fetch live prices and update local snapshot file atomically.
 */
export async function updateLocalPriceSnapshot({
  outputPath,
  fetchImpl = fetch,
  onWarning = null,
}) {
  const fallbackSnapshot = await readFile(outputPath, "utf8")
    .then((data) => JSON.parse(data))
    .catch(() => null);

  const { snapshot, diagnostics } = await buildCatalogSnapshot({
    fallbackSnapshot,
    fetchImpl,
    onWarning,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(snapshot)}\n`);
  await rename(temporaryPath, outputPath);

  return { snapshot, diagnostics };
}
