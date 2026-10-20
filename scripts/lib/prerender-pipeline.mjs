import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { siteConfig } from "../../app/site-config.ts";
import { buildGuideReference } from "../../app/steel-reference.ts";
import {
  buildMenuCatalog,
  loadOverviewSummaries,
  primeCatalogSnapshot,
  setMenuCatalog,
} from "../../app/catalog-reader.ts";
import {
  REDIRECT_ROUTES,
  buildRedirectHtml,
  buildSitemapXml,
  renderStaticDocument,
} from "./static-document.mjs";
import { collectSitePageDescriptors } from "./site-pages.mjs";

/**
 * Static site generation: prime the catalog caches, ask site-pages.mjs which
 * pages exist, hand each to static-document.mjs, and write the result.
 *
 * The two modules it sits on are the ones with the content. This file is the
 * sequence, and it used to also be both of them -- 732 lines behind fourteen
 * exports, half of which no test could reach without running a full build
 * first, because the entry point read `dist/index.html` and a 2.4 MB snapshot
 * off disk unconditionally. Both reads are now seams: production passes
 * nothing and gets the real files, a test passes its own.
 */

/**
 * The files to modulepreload for a lazily loaded page module: its own chunk
 * and the shared chunks it imports, but not the entry bundle, which the page
 * already loads. `manifest` is Vite's build manifest; null preloads nothing.
 */
export function modulePreloadsFor(manifest, source) {
  if (!manifest || !source) return [];
  if (!manifest[source]) {
    throw new Error(`No chunk for ${source} in the Vite build manifest.`);
  }
  const files = [];
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk || chunk.isEntry || files.includes(`/${chunk.file}`)) return;
    files.push(`/${chunk.file}`);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  visit(source);
  return files;
}

/**
 * Renders every page in memory before writing anything, so a failure part-way
 * through leaves the previous dist untouched rather than half-replaced.
 */
export async function writePrerenderArtifacts({
  distDir,
  templateHtml,
  pages,
  rootLastmod,
  siteUrl,
}) {
  // 1. Render all HTML documents in memory
  const renderedOutputs = pages.map((page) => ({
    outPath: page.outPath,
    html: renderStaticDocument(templateHtml, page),
  }));

  // 2. Generate sitemap XML in memory
  const sitemapXml = buildSitemapXml({ siteUrl, rootLastmod, pages });

  // 3. Write all HTML files to dist
  await Promise.all(
    renderedOutputs.map(async ({ outPath, html }) => {
      const outDir = resolve(distDir, ...outPath);
      await mkdir(outDir, { recursive: true });
      await writeFile(resolve(outDir, "index.html"), html, "utf8");
    }),
  );

  // 4. Write sitemap.xml
  await writeFile(resolve(distDir, "sitemap.xml"), sitemapXml, "utf8");

  // 5. Write permanent redirect stubs for single subcategory URLs
  for (const { fromPath, toUrl, targetLabel } of REDIRECT_ROUTES) {
    const outDir = resolve(distDir, ...fromPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      buildRedirectHtml({ toUrl, targetLabel }),
      "utf8",
    );
  }

  // Every page written also gets a sitemap entry, so one count describes both.
  return { pageCount: pages.length };
}

/**
 * Main entry point for static site generation.
 *
 * `readTemplate` and `readSnapshot` are the seams. They default to the real
 * build's inputs -- the Vite-built shell and the committed catalog snapshot --
 * and exist so the sequence below can be exercised without either.
 */
export async function generateStaticSite({
  distDir = resolve(import.meta.dirname, "..", "..", "dist"),
  dataDir = resolve(import.meta.dirname, "..", "..", "app", "data"),
  siteUrl = siteConfig.siteUrl,
  readTemplate = () => readFile(resolve(distDir, "index.html"), "utf8"),
  readSnapshot = async () =>
    JSON.parse(await readFile(resolve(dataDir, "catalog-prices.json"), "utf8")),
  readManifest = () => readViteManifest(distDir),
  writeArtifacts = writePrerenderArtifacts,
} = {}) {
  const [templateHtml, snapshot, manifest] = await Promise.all([
    readTemplate(),
    readSnapshot(),
    readManifest(),
  ]);

  // Prime catalog cache
  primeCatalogSnapshot(snapshot);

  // Build shared projections
  const [menuCatalog, overviewSummaries] = await Promise.all([
    buildMenuCatalog(),
    loadOverviewSummaries(),
  ]);
  setMenuCatalog(menuCatalog);

  const reference = buildGuideReference(snapshot);

  // Collect page descriptors
  const { pages, rootLastmod } = await collectSitePageDescriptors({
    snapshot,
    menuCatalog,
    overviewSummaries,
    reference,
    siteUrl,
  });

  const result = await writeArtifacts({
    distDir,
    templateHtml,
    pages: pages.map((page) => ({
      ...page,
      modulePreloadHrefs: modulePreloadsFor(manifest, page.pageModuleSource),
    })),
    rootLastmod,
    siteUrl,
  });
  if (manifest) await rm(resolve(distDir, ".vite"), { recursive: true, force: true });
  return result;
}

/** Vite's build manifest, or null when there is none (a test's distDir). */
async function readViteManifest(distDir) {
  try {
    return JSON.parse(await readFile(resolve(distDir, ".vite", "manifest.json"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}
