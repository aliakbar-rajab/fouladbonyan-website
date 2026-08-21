import {
  rebarSources,
  beamSources,
  productCatalogs,
} from "../../scripts/price-catalog-config.mjs";
import {
  validateCatalogPriceData,
  validateProductPricePayload,
} from "../../app/catalog-validation.mjs";

export const KV_KEYS = {
  rebar: "rebar-prices",
  beam: "beam-prices",
  product: "product-prices",
};

export const STATUS_KEY = "refresh-status";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateAll(payloads) {
  if (!isRecord(payloads)) {
    throw new Error("بدنه درخواست شیء نیست.");
  }
  for (const key of Object.keys(KV_KEYS)) {
    if (!isRecord(payloads[key])) {
      throw new Error(`payload.${key} وجود ندارد یا شیء نیست.`);
    }
  }
  validateCatalogPriceData(payloads.rebar, {
    expectedCategoryIds: rebarSources.map((source) => source.id),
  });
  validateCatalogPriceData(payloads.beam, {
    expectedCategoryIds: beamSources.map((source) => source.id),
  });
  validateProductPricePayload(payloads.product, {
    expectedCatalogs: productCatalogs.map((catalog) => ({
      id: catalog.id,
      categoryIds: catalog.sources.map((source) => source.id),
    })),
  });
}

/**
 * Validate a { rebar, beam, product } payload handed to us by the trusted
 * GitHub Actions fetcher/relay and, only if every dataset passes, replace
 * the stored snapshot. Cloudflare's network cannot reach the upstream
 * source itself (fooladiranian.com's DNS is unreachable from Cloudflare's
 * resolvers -- confirmed directly while building this), so the actual
 * scraping now happens in GitHub Actions, which has ordinary internet
 * access; this function keeps the same validate-before-publish,
 * all-or-nothing contract the retired GitHub Actions auto-commit job and
 * the original Worker-does-its-own-fetching design both had. A failure
 * here leaves the last stored snapshot in KV untouched.
 */
export async function ingestAll(kv, payloads) {
  const startedAt = new Date().toISOString();
  try {
    validateAll(payloads);
    await Promise.all(
      Object.entries(KV_KEYS).map(([key, kvKey]) =>
        kv.put(kvKey, JSON.stringify(payloads[key])),
      ),
    );
    const status = { ok: true, at: startedAt, finishedAt: new Date().toISOString() };
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
