/**
 * The contract for the header's market widget payload (gold, dollar, tether,
 * euro from tgju.org). It has nothing to do with the steel Catalog snapshot,
 * and used to live in catalog-validation.mjs only because both were "price
 * validation" — which also bundled it into the price-refresh Worker.
 */
const VALID_STATUSES = new Set(["up", "down", "same", "unverified"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(`داده قیمت نامعتبر است: ${message}`);
}

const MARKET_ITEM_IDS = ["gold", "usd", "tether", "eur"];

export function validateMarketPriceData(payload) {
  assert(isRecord(payload), "market شیء نیست");
  assert(
    typeof payload.fetchedAt === "string" &&
      Number.isFinite(Date.parse(payload.fetchedAt)),
    "market.fetchedAt معتبر نیست",
  );
  assert(
    typeof payload.sourceName === "string" && payload.sourceName.trim(),
    "market.sourceName خالی است",
  );
  assert(
    typeof payload.sourceUrl === "string" &&
      /^https:\/\//.test(payload.sourceUrl),
    "market.sourceUrl معتبر نیست",
  );
  assert(Array.isArray(payload.items), "market.items آرایه نیست");
  assert(
    payload.items.length === MARKET_ITEM_IDS.length &&
      MARKET_ITEM_IDS.every((id, index) => payload.items[index]?.id === id),
    "ترتیب یا تعداد آیتم‌های بازار با قرارداد منبع همخوان نیست",
  );
  payload.items.forEach((item, index) => {
    const location = `market.items[${index}]`;
    assert(isRecord(item), `${location} شیء نیست`);
    assert(
      typeof item.label === "string" && item.label.trim(),
      `${location}.label خالی است`,
    );
    assert(
      typeof item.unit === "string" && item.unit.trim(),
      `${location}.unit خالی است`,
    );
    assert(
      Number.isFinite(item.price) && item.price > 0,
      `${location}.price معتبر نیست`,
    );
    assert(VALID_STATUSES.has(item.status), `${location}.status معتبر نیست`);
    assert(
      Number.isFinite(item.percent) && item.percent >= 0,
      `${location}.percent معتبر نیست`,
    );
    assert(
      typeof item.updatedAt === "string" &&
        Number.isFinite(Date.parse(item.updatedAt)),
      `${location}.updatedAt معتبر نیست`,
    );
  });
  return payload;
}
