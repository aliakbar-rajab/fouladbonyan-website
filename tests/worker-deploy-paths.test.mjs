import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const workerDir = "workers/price-refresh";

// Every relative module a file statically imports. The Worker is bundled by
// wrangler from these, so this is the set of files whose change alters what
// the deployed Worker does.
async function importClosure(entry) {
  const seen = new Set();
  const pending = [resolve(repoRoot, entry)];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const source = await readFile(file, "utf8");
    for (const [, specifier] of source.matchAll(
      /(?:^|\n)\s*(?:import|export)\b[^"']*?["'](\.{1,2}\/[^"']+)["']/g,
    )) {
      pending.push(resolve(dirname(file), specifier));
    }
  }
  return [...seen].map((file) => relative(repoRoot, file).replaceAll("\\", "/"));
}

async function deployPaths() {
  const workflow = await readFile(
    resolve(repoRoot, ".github/workflows/deploy-price-worker.yml"),
    "utf8",
  );
  const block = workflow.match(/paths:\n((?:\s+- "[^"]+"\n)+)/);
  assert.ok(block, "deploy workflow has no paths filter");
  return [...block[1].matchAll(/- "([^"]+)"/g)].map((match) => match[1]);
}

test("the Worker deploy trigger covers every file the Worker bundles", async () => {
  const paths = await deployPaths();
  const covered = (file) =>
    paths.some((path) =>
      path.endsWith("/**") ? file.startsWith(path.slice(0, -2)) : file === path,
    );
  const closure = await importClosure(`${workerDir}/worker.mjs`);
  assert.ok(closure.length > 3, "import walk found nothing past the entry");
  assert.deepEqual(
    closure.filter((file) => !covered(file)),
    [],
    "a file the Worker imports can change without redeploying it",
  );
});

test("the Worker bundle stays out of build tooling", async () => {
  const closure = await importClosure(`${workerDir}/worker.mjs`);
  assert.deepEqual(
    closure.filter((file) => file.startsWith("scripts/")),
    [],
  );
});
