import { allCatalogConfigs } from "../../scripts/price-catalog-config.mjs";
import { validateCatalogSnapshot } from "../../app/catalog-validation.mjs";

export const KV_KEYS = {
  catalog: "catalog-prices",
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
 * Validate a canonical snapshot and, only if it passes, replace the stored
 * snapshot in KV.
 */
export async function ingestAll(kv, payloads) {
  const startedAt = new Date().toISOString();
  try {
    const snapshot = validateAll(payloads);
    const snapshotJson = JSON.stringify(snapshot);

    await kv.put(KV_KEYS.catalog, snapshotJson);

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


