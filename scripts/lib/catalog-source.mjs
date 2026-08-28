import { setTimeout as sleep } from "node:timers/promises";
import { toAsciiDigits, toPersianDigits } from "../../app/site-logic.mjs";
import { deriveSummaryFromRows } from "../../app/catalog-validation.mjs";

// Every price snapshot comes from the same Next.js-rendered source, so the
// scraping and shaping live here once; each caller only declares which pages
// to read. No node built-ins here on purpose -- this module runs both in
// Node fetch scripts (scripts/fetch-*-prices.mjs) and in the Cloudflare
// Worker (workers/price-refresh) that replaced them as the scheduled source.
export const SOURCE_ENVELOPE = {
  sourceName: "فولاد ایرانیان",
  sourceHome: "https://www.fooladiranian.com/",
  taxRate: 0.1,
};

const SOURCE_ROOT = "https://www.fooladiranian.com/productlist/";

/** Build a source URL from a Persian slug, keeping hyphens unescaped. */
export function sourceUrl(slug) {
  return new URL(`${encodeURIComponent(slug).replaceAll("%2D", "-")}/`, SOURCE_ROOT)
    .href;
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
  const firstNumber = Number.parseFloat(
    toAsciiDigits(String(first ?? ""))
      .replace(/[/٫]/g, ".")
      .replace(/[^\d.]/g, ""),
  );
  const secondNumber = Number.parseFloat(
    toAsciiDigits(String(second ?? ""))
      .replace(/[/٫]/g, ".")
      .replace(/[^\d.]/g, ""),
  );
  if (Number.isFinite(firstNumber) && Number.isFinite(secondNumber)) {
    return firstNumber - secondNumber;
  }
  return String(first).localeCompare(String(second), "fa");
}

/**
 * @param {object} source
 * @param {string} source.id
 * @param {string} source.label
 * @param {string} source.url
 * @param {number} [source.minimumItems] reject a page that lost most of its rows
 * @param {string} [source.groupingLabel] what the factory column is called
 * @param {string} [source.specificationKey] meta published as row.specification
 * @param {string} [source.specificationLabel] header for the spec column
 * @param {string[]} [source.detailKeys] extra metas to publish per row
 * @param {(item: object) => string} [source.deriveSize] override the size meta
 */
export function parseCatalogPage(html, source) {
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
    throw new Error(`تجزیه JSON ساختاریافته صفحه ${source.label} ناموفق بود: ${error.message}`, {
      cause: error,
    });
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
      // Derived from the rows, never from compare.min_price/max_price/avg_price:
      // the upstream fields are rial and rounding them to hundreds of toman
      // produced prices that appear in no row of the table.
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

export async function fetchCategoryOnce(source, { timeoutMs = 25_000, fetchImpl = fetch } = {}) {
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

// Requests through edge networks hit upstreams and CDNs (such as ArvanCloud)
// with transient 5xx or 429 rate limits. An exponential backoff with jitter
// handles temporary spikes cleanly without failing immediately.
export async function fetchCategory(
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

/**
 * Fetch every source with concurrency control, robust retries, and category-level
 * error isolation with fallback support.
 * Returns { categories, diagnostics }.
 */
export async function fetchCategoriesWithDiagnostics(sources, options = {}) {
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
            return { category: fallback, fresh: false, fallback: true, error: error.message };
          }
          // No fallback available: fail explicitly rather than silently omitting
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


