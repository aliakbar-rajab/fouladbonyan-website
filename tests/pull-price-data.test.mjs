import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pullPriceSnapshot } from "../scripts/lib/price-pipeline.mjs";

async function withTempFile(initialContent, run) {
  const dir = await mkdtemp(join(tmpdir(), "pull-price-data-"));
  const outputPath = join(dir, "snapshot.json");
  await writeFile(outputPath, initialContent);
  try {
    await run(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("pull workflow validates and replaces the complete Catalog snapshot", async () => {
  const snapshot = JSON.parse(
    await readFile(
      new URL("../app/data/catalog-prices.json", import.meta.url),
      "utf8",
    ),
  );
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const result = await pullPriceSnapshot({
      endpoint: "https://price.example",
      outputPath,
      fetchImpl: async () =>
        new Response(JSON.stringify(snapshot), { status: 200 }),
    });

    assert.equal(result.ok, true);
    assert.equal(result.fetchedAt, snapshot.fetchedAt);
    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), snapshot);
  });
});

for (const [name, fetchImpl, errorPattern] of [
  [
    "upstream HTTP failure",
    async () => new Response("service unavailable", { status: 503 }),
    /HTTP 503/,
  ],
  [
    "network failure",
    async () => {
      throw new Error("network unreachable");
    },
    /network unreachable/,
  ],
]) {
  test(`pull workflow leaves the prior snapshot untouched on ${name}`, async () => {
    await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
      const result = await pullPriceSnapshot({
        endpoint: "https://price.example",
        outputPath,
        fetchImpl,
      });
      assert.equal(result.ok, false);
      assert.match(result.error, errorPattern);
      assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"old"}\n');
    });
  });
}

test("pull workflow leaves the prior snapshot untouched when validation fails", async () => {
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const invalidSnapshot = {
      fetchedAt: new Date().toISOString(),
      sourceName: "فولاد ایرانیان",
      sourceHome: "https://www.fooladiranian.com/",
      taxRate: 0.1,
      catalogs: [],
    };
    const result = await pullPriceSnapshot({
      endpoint: "https://price.example",
      outputPath,
      fetchImpl: async () =>
        new Response(JSON.stringify(invalidSnapshot), { status: 200 }),
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /کاتالوگ|نامعتبر/);
    assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"old"}\n');
  });
});
