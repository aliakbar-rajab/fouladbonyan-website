import { buildAllPayloads } from "./lib/build-price-payloads.mjs";
import { publishPayloads } from "./lib/publish-price-payloads.mjs";

// Entry point for the scheduled GitHub Actions relay
// (.github/workflows/price-refresh.yml): fetch + validate the three
// datasets from the live source, then hand them to the Cloudflare Worker,
// which validates them again and, only if they pass, stores them and
// triggers a Pages rebuild. This process never touches git -- there is
// nothing here that reads or writes app/data, and nothing that commits or
// pushes. A failure at any step (fetch, validation, or the Worker rejecting
// the payload) exits non-zero, which is exactly and only a failed Actions
// run: Cloudflare keeps serving whatever it already had.
const endpoint = process.env.PRICE_DATA_ENDPOINT;
const token = process.env.PRICE_INGEST_TOKEN;

if (!endpoint || !token) {
  console.error(
    "PRICE_DATA_ENDPOINT و PRICE_INGEST_TOKEN باید هر دو تنظیم شده باشند.",
  );
  process.exit(1);
}

const payloads = await buildAllPayloads();
const result = await publishPayloads({ endpoint, token, payloads });
console.log(`داده‌های قیمت با موفقیت به Cloudflare ارسال و منتشر شد: ${JSON.stringify(result)}`);
