import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deriveSummaryFromRows } from "../app/catalog-validation.mjs";

// Every price snapshot comes from the same Next.js-rendered source, so the
// scraping, shaping and writing live here once; each fetch script only
// declares which pages it reads and where the result goes.
export const SOURCE_ENVELOPE = {
  sourceName: "فولاد ایرانیان",
  sourceHome: "https://www.fooladiranian.com/",
  taxRate: 0.1,
};

export const SOURCE_ROOT = "https://www.fooladiranian.com/productlist/";

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

export function toPersianDigits(value = "") {
  return String(value)
    .replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 1728),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 144),
    );
}

export function metaValue(item, key) {
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
  const firstNumber = Number.parseFloat(String(first).replace(/[^\d.]/g, ""));
  const secondNumber = Number.parseFloat(String(second).replace(/[^\d.]/g, ""));
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
function parseCatalogPage(html, source) {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s,
  );
  if (!match) {
    throw new Error(`داده ساختاریافته در صفحه ${source.label} پیدا نشد.`);
  }

  const shopData = JSON.parse(match[1])?.props?.pageProps?.shopData;
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

async function fetchCategory(source) {
  const response = await fetch(source.url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "fa-IR,fa;q=0.9",
      "user-agent": "Bonyan-Foulad-Daria/1.0 (+https://fouladbonyan.com/)",
    },
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) {
    throw new Error(`${source.label}: HTTP ${response.status}`);
  }
  return parseCatalogPage(await response.text(), source);
}

/** Fetch every source, at most `limit` pages in flight. */
export async function fetchCategories(sources, limit = 6) {
  const categories = [];
  for (let index = 0; index < sources.length; index += limit) {
    categories.push(
      ...(await Promise.all(sources.slice(index, index + limit).map(fetchCategory))),
    );
  }
  return categories;
}

export async function writeSnapshot(outputPath, payload, describe) {
  await mkdir(dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(payload)}\n`);
  await rename(temporaryPath, outputPath);
  console.log(describe(countRows(payload)));
}

function countRows(payload) {
  const categories =
    payload.categories ??
    payload.catalogs.flatMap((catalog) => catalog.categories);
  return categories.reduce(
    (total, category) =>
      total +
      category.factories.reduce(
        (factoryTotal, factory) => factoryTotal + factory.rows.length,
        0,
      ),
    0,
  );
}
