import assert from "node:assert/strict";
import test from "node:test";
import { onRequest } from "../functions/_middleware.js";

function makeContext(url, method = "GET") {
  let nextCalled = false;
  return {
    request: new Request(url, { method }),
    next: () => {
      nextCalled = true;
      return new Response("next", { status: 200 });
    },
    wasNextCalled: () => nextCalled,
  };
}

test("301 redirects parameterised /quote-process/ URLs (including encoded newlines) to clean canonical URL", () => {
  const ctx = makeContext(
    "https://fouladbonyan.com/quote-process/?product=%D9%85%DB%8C%D9%84%DA%AF%D8%B1%D8%AF&dimensions=%D9%85%DB%8C%D9%84%DA%AF%D8%B1%D8%AF%20%0A18%20%D9%85%DB%8C%D8%A7%D9%86%D9%87",
  );
  const res = onRequest(ctx);
  assert.equal(ctx.wasNextCalled(), false);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "https://fouladbonyan.com/quote-process/");
});

test("301 redirects parameterised /quote-process without trailing slash and supports HEAD", () => {
  const ctx = makeContext(
    "https://fouladbonyan.com/quote-process?product=%D9%85%DB%8C%D9%84%DA%AF%D8%B1%D8%AF",
    "HEAD",
  );
  const res = onRequest(ctx);
  assert.equal(ctx.wasNextCalled(), false);
  assert.equal(res.status, 301);
  assert.equal(res.headers.get("location"), "https://fouladbonyan.com/quote-process/");
});

test("passes through clean /quote-process/, unrelated query routes, and non-GET/HEAD methods", () => {
  for (const [url, method] of [
    ["https://fouladbonyan.com/quote-process/", "GET"],
    ["https://fouladbonyan.com/rebar/ribbed/?factory=ذوب", "GET"],
    ["https://fouladbonyan.com/quote-process/?product=rebar", "POST"],
  ]) {
    const ctx = makeContext(url, method);
    const res = onRequest(ctx);
    assert.equal(ctx.wasNextCalled(), true, `${method} ${url} should pass through`);
    assert.equal(res.status, 200);
  }
});
