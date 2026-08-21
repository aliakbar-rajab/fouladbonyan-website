/**
 * POST a fetched+validated { rebar, beam, product } payload set to the
 * Cloudflare Worker's ingest endpoint. The Worker re-validates independently
 * before storing anything (defense in depth -- this caller being trusted
 * doesn't mean a malformed payload should ever reach KV), so a non-2xx
 * response here means the Worker rejected it or something upstream broke,
 * not that this function itself found a problem.
 */
export async function publishPayloads({ endpoint, token, payloads, fetchImpl = fetch }) {
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
