import { allCatalogConfigs } from "../../scripts/price-catalog-config.mjs";
import { validateCatalogSnapshot } from "../../app/catalog-validation.mjs";

export const KV_KEYS = {
  catalog: "catalog-prices",
  rebar: "rebar-prices",
  beam: "beam-prices",
  product: "product-prices",
};

export const STATUS_KEY = "refresh-status";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeToSnapshot(payloads) {
  if (!isRecord(payloads)) {
    throw new Error("بدنه درخواست شیء نیست.");
  }
  if (payloads.snapshot && Array.isArray(payloads.snapshot.catalogs)) {
    return payloads.snapshot;
  }
  if (Array.isArray(payloads.catalogs)) {
    return payloads;
  }
  if (payloads.rebar && payloads.beam && payloads.product) {
    return {
      fetchedAt: payloads.rebar.fetchedAt || new Date().toISOString(),
      sourceName: payloads.rebar.sourceName || "فولاد ایرانیان",
      sourceHome: payloads.rebar.sourceHome || "https://www.fooladiranian.com/",
      taxRate: payloads.rebar.taxRate ?? 0.1,
      catalogs: [
        {
          id: "rebar",
          label: "میلگرد",
          initialCategoryId: "ribbed",
          categories: payloads.rebar.categories,
        },
        {
          id: "beam",
          label: "تیرآهن",
          initialCategoryId: "beam",
          categories: payloads.beam.categories,
        },
        ...(payloads.product.catalogs ?? []),
      ],
    };
  }
  throw new Error("داده کاتالوگ نامعتبر است: داده‌های قیمت در درخواست یافت نشد.");
}

export function validateAll(payloads) {
  const snapshot = normalizeToSnapshot(payloads);
  validateCatalogSnapshot(snapshot, {
    expectedCatalogs: allCatalogConfigs.map((catalog) => ({
      id: catalog.id,
      categoryIds: catalog.sources.map((source) => source.id),
    })),
  });
  return snapshot;
}

/**
 * Validate a canonical snapshot (or legacy triple payload) and, only if it
 * passes, replace the stored snapshot in KV.
 */
export async function ingestAll(kv, payloads) {
  const startedAt = new Date().toISOString();
  try {
    const snapshot = validateAll(payloads);
    const snapshotJson = JSON.stringify(snapshot);

    const rebarLegacy = JSON.stringify({
      fetchedAt: snapshot.fetchedAt,
      sourceName: snapshot.sourceName,
      sourceHome: snapshot.sourceHome,
      taxRate: snapshot.taxRate,
      categories:
        snapshot.catalogs.find((c) => c.id === "rebar")?.categories ?? [],
    });
    const beamLegacy = JSON.stringify({
      fetchedAt: snapshot.fetchedAt,
      sourceName: snapshot.sourceName,
      sourceHome: snapshot.sourceHome,
      taxRate: snapshot.taxRate,
      categories:
        snapshot.catalogs.find((c) => c.id === "beam")?.categories ?? [],
    });
    const productLegacy = JSON.stringify({
      fetchedAt: snapshot.fetchedAt,
      sourceName: snapshot.sourceName,
      sourceHome: snapshot.sourceHome,
      taxRate: snapshot.taxRate,
      catalogs: snapshot.catalogs.filter(
        (c) => c.id !== "rebar" && c.id !== "beam",
      ),
    });

    await Promise.all([
      kv.put(KV_KEYS.catalog, snapshotJson),
      kv.put(KV_KEYS.rebar, rebarLegacy),
      kv.put(KV_KEYS.beam, beamLegacy),
      kv.put(KV_KEYS.product, productLegacy),
    ]);

    const status = {
      ok: true,
      at: startedAt,
      finishedAt: new Date().toISOString(),
      ...(payloads.diagnostics ? { diagnostics: payloads.diagnostics } : {}),
    };
    await kv.put(STATUS_KEY, JSON.stringify(status));
    return status;
  } catch (error) {
    const status = {
      ok: false,
      at: startedAt,
      finishedAt: new Date().toISOString(),
      error: String(error?.message ?? error),
    };
    await kv.put(STATUS_KEY, JSON.stringify(status));
    return status;
  }
}


