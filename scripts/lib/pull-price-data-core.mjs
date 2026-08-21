import { writeFile } from "node:fs/promises";

/**
 * Fetch one dataset from the Cloudflare Worker and, only if the request
 * succeeds and the payload passes validation, overwrite outputPath with it.
 * Any failure (network, non-2xx, invalid shape) is reported but never
 * thrown -- the caller keeps whatever is already on disk, which is exactly
 * how a failed "npm run prices:update" used to leave the last committed
 * snapshot in place.
 */
export async function pullDataset({
  endpoint,
  name,
  outputPath,
  validate,
  fetchImpl = fetch,
}) {
  try {
    const response = await fetchImpl(`${endpoint}/${name}.json`, {
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    validate(data);
    await writeFile(outputPath, `${JSON.stringify(data)}\n`);
    return { ok: true, fetchedAt: data.fetchedAt };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}
