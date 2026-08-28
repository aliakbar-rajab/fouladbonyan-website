import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  pullDataset,
  pullPriceSnapshot,
} from "../scripts/lib/price-pipeline.mjs";

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

test("pullDataset overwrites the output file when the fetch succeeds and validates", async () => {
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ fetchedAt: "new" }), { status: 200 });

    const result = await pullDataset({
      endpoint: "https://price.example",
      name: "rebar-prices",
      outputPath,
      validate: () => {},
      fetchImpl,
    });

    assert.equal(result.ok, true);
    assert.equal(result.fetchedAt, "new");
    assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"new"}\n');
  });
});

test("pullDataset leaves the file untouched when the upstream fetch fails", async () => {
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const fetchImpl = async () =>
      new Response("service unavailable", { status: 503 });

    const result = await pullDataset({
      endpoint: "https://price.example",
      name: "rebar-prices",
      outputPath,
      validate: () => {},
      fetchImpl,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /HTTP 503/);
    assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"old"}\n');
  });
});

test("pullDataset leaves the file untouched when the fetch throws (network error)", async () => {
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const fetchImpl = async () => {
      throw new Error("network unreachable");
    };

    const result = await pullDataset({
      endpoint: "https://price.example",
      name: "rebar-prices",
      outputPath,
      validate: () => {},
      fetchImpl,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /network unreachable/);
    assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"old"}\n');
  });
});

test("pullDataset leaves the file untouched when validation rejects the payload", async () => {
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const fetchImpl = async () =>
      new Response(JSON.stringify({ fetchedAt: "new" }), { status: 200 });

    const result = await pullDataset({
      endpoint: "https://price.example",
      name: "rebar-prices",
      outputPath,
      validate: () => {
        throw new Error("داده قیمت نامعتبر است");
      },
      fetchImpl,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /نامعتبر/);
    assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"old"}\n');
  });
});

test("pullPriceSnapshot executes full schema validation against catalog snapshot payload", async () => {
  await withTempFile('{"fetchedAt":"old"}\n', async (outputPath) => {
    const invalidSnapshot = {
      fetchedAt: new Date().toISOString(),
      sourceName: "فولاد ایرانیان",
      sourceHome: "https://www.fooladiranian.com/",
      taxRate: 0.1,
      catalogs: [], // Invalid: missing expected catalogs
    };
    const fetchImpl = async () =>
      new Response(JSON.stringify(invalidSnapshot), { status: 200 });

    const result = await pullPriceSnapshot({
      endpoint: "https://price.example",
      outputPath,
      fetchImpl,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /کاتالوگ|نامعتبر/);
    assert.equal(await readFile(outputPath, "utf8"), '{"fetchedAt":"old"}\n');
  });
});
