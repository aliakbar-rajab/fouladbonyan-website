import assert from "node:assert/strict";
import test from "node:test";
import { publishPayloads } from "../scripts/lib/publish-price-payloads.mjs";

test("publishPayloads posts the payload with a bearer token and returns the parsed body", async () => {
  let seenRequest;
  const fetchImpl = async (url, init) => {
    seenRequest = { url, init };
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await publishPayloads({
    endpoint: "https://price.example",
    token: "secret-token",
    payloads: { rebar: {}, beam: {}, product: {} },
    fetchImpl,
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(seenRequest.url, "https://price.example/ingest");
  assert.equal(seenRequest.init.method, "POST");
  assert.equal(seenRequest.init.headers.authorization, "Bearer secret-token");
  assert.deepEqual(JSON.parse(seenRequest.init.body), { rebar: {}, beam: {}, product: {} });
});

test("publishPayloads throws with the Worker's error message on a non-2xx response", async () => {
  const fetchImpl = async () =>
    new Response(JSON.stringify({ ok: false, error: "میلگرد آجدار: HTTP 503" }), { status: 422 });

  await assert.rejects(
    () =>
      publishPayloads({
        endpoint: "https://price.example",
        token: "secret-token",
        payloads: { rebar: {}, beam: {}, product: {} },
        fetchImpl,
      }),
    /HTTP 422.*میلگرد آجدار/,
  );
});

test("publishPayloads throws when the response body isn't JSON", async () => {
  const fetchImpl = async () => new Response("upstream 502", { status: 502 });

  await assert.rejects(
    () =>
      publishPayloads({
        endpoint: "https://price.example",
        token: "secret-token",
        payloads: { rebar: {}, beam: {}, product: {} },
        fetchImpl,
      }),
    /HTTP 502/,
  );
});
