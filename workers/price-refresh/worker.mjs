import { ingestAll, CATALOG_KEY, STATUS_KEY } from "./ingest.mjs";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    headers: JSON_HEADERS,
    ...init,
  });
}

async function serveDataset(kv, kvKey) {
  const value = await kv.get(kvKey);
  if (!value) {
    return json({ error: "not ready" }, { status: 503 });
  }
  return new Response(value, {
    headers: { ...JSON_HEADERS, "cache-control": "public, max-age=60" },
  });
}

// Both paths serve the one stored snapshot; /catalog-snapshot.json is the
// older name, still linked from elsewhere.
const CATALOG_PATHS = [`/${CATALOG_KEY}.json`, "/catalog-snapshot.json"];

function isAuthorized(request, env) {
  const expected = env.INGEST_TOKEN ? `Bearer ${env.INGEST_TOKEN}` : null;
  return Boolean(expected) && request.headers.get("authorization") === expected;
}

// GET routes are public and read-only -- the same price data is already
// public on the site itself. The only write path is POST /ingest, called by
// the scheduled GitHub Actions relay (.github/workflows/price-refresh.yml),
// which is the only thing on Cloudflare's side able to reach
// fooladiranian.com's upstream. Cloudflare's own network cannot resolve or
// reach it at all (verified directly), so this Worker never fetches the
// upstream itself -- it only validates and stores what the relay sends.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/status") {
      const status = (await env.PRICE_DATA.get(STATUS_KEY)) ?? JSON.stringify({ ok: null });
      return new Response(status, { headers: JSON_HEADERS });
    }

    if (request.method === "GET" && CATALOG_PATHS.includes(url.pathname)) {
      return serveDataset(env.PRICE_DATA, CATALOG_KEY);
    }

    if (request.method === "POST" && url.pathname === "/ingest") {
      if (!isAuthorized(request, env)) {
        return new Response("Unauthorized", { status: 401 });
      }
      let payloads;
      try {
        payloads = await request.json();
      } catch {
        return json({ ok: false, error: "بدنه JSON معتبر نیست." }, { status: 400 });
      }
      const status = await ingestAll(env.PRICE_DATA, payloads);
      if (status.ok && env.DEPLOY_HOOK_URL) {
        try {
          const deployResponse = await fetch(env.DEPLOY_HOOK_URL, {
            method: "POST",
          });
          if (!deployResponse.ok) {
            throw new Error(`Deploy hook returned HTTP ${deployResponse.status}`);
          }
        } catch (error) {
          const failedStatus = {
            ...status,
            ok: false,
            stored: true,
            stage: "deploy-hook",
            finishedAt: new Date().toISOString(),
            error: String(error?.message ?? error),
          };
          await env.PRICE_DATA.put(STATUS_KEY, JSON.stringify(failedStatus));
          return json(failedStatus, { status: 502 });
        }
      }
      return json(status, { status: status.ok ? 200 : 422 });
    }

    return new Response("Not found", { status: 404 });
  },
};
