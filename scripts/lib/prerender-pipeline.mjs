import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { siteConfig } from "../../app/site-config.ts";
import { buildRedirectsFile, siteRedirectRoutes } from "../../app/site-page.ts";
import { buildGuideReference } from "../../app/steel-reference.ts";
import {
  buildMenuCatalog,
  buildOverviewSummaries,
  primeCatalogReader,
  resetCatalogReader,
} from "../../app/catalog-reader.ts";
import {
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
  redirectRoutes = siteRedirectRoutes(siteUrl),
  redirectsText = buildRedirectsFile(),
}) {
  // 1. Render all HTML documents in memory
  const renderedOutputs = pages.map((page) => ({
    outPath: page.outPath,
    html: renderStaticDocument(templateHtml, page),
  }));

  // 2. Generate sitemap XML in memory
  const sitemapXml = buildSitemapXml({ siteUrl, rootLastmod, pages });

  // 3. Create output directories sequentially (avoids parent/child mkdir
  // races on Windows), then write all HTML files to dist.
  const preparedOutputs = renderedOutputs.map(({ outPath, html }) => ({
    outDir: resolve(distDir, ...outPath),
    html,
  }));
  for (const { outDir } of preparedOutputs) {
    await mkdir(outDir, { recursive: true });
  }
  await Promise.all(
    preparedOutputs.map(({ outDir, html }) =>
      writeFile(resolve(outDir, "index.html"), html, "utf8"),
    ),
  );

  // 4. Write sitemap.xml and generated _redirects
  await Promise.all([
    writeFile(resolve(distDir, "sitemap.xml"), sitemapXml, "utf8"),
    writeFile(resolve(distDir, "_redirects"), redirectsText, "utf8"),
  ]);

  // 5. Write permanent redirect stubs for consolidated / renamed catalog URLs
  for (const { fromPath, toUrl, targetLabel } of redirectRoutes) {
    const outDir = resolve(distDir, ...fromPath);
    await mkdir(outDir, { recursive: true });
    await writeFile(
      resolve(outDir, "index.html"),
      buildRedirectHtml({ toUrl, targetLabel }),
      "utf8",
    );
  }

  const sitemapCount = pages.filter((page) => !page.noindex).length;
  return { pageCount: pages.length, sitemapCount };
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

  // Build shared projections from the snapshot, then reset and prime the
  // catalog store for SSR rendering.
  const menuCatalog = await buildMenuCatalog(snapshot);
  const overviewSummaries = buildOverviewSummaries(snapshot);
  resetCatalogReader();
  primeCatalogReader({
    snapshot,
    menu: menuCatalog,
    overview: overviewSummaries,
  });

  const reference = buildGuideReference(snapshot);

  // Collect page descriptors
  const { pages, rootLastmod, redirectRoutes, redirectsText } =
    await collectSitePageDescriptors({
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
    redirectRoutes,
    redirectsText,
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
