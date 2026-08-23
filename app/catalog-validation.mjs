const VALID_STATUSES = new Set(["up", "down", "same"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assert(condition, message) {
  if (!condition) throw new Error(`داده قیمت نامعتبر است: ${message}`);
}

/**
 * The single definition of what a category summary means: it describes the
 * priced rows of that category and nothing else. Both the fetch scripts and
 * the validator use this, so a summary can never drift from its rows.
 */
export function deriveSummaryFromRows(rows) {
  const prices = rows
    .map((row) => Number(row.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) return { min: 0, max: 0, average: 0 };
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: Math.round(
      prices.reduce((total, price) => total + price, 0) / prices.length,
    ),
  };
}

function validateSummary(summary, location, rows) {
  assert(isRecord(summary), `${location}.summary وجود ندارد`);
  for (const field of ["min", "max", "average", "percent"]) {
    assert(
      Number.isFinite(summary[field]),
      `${location}.summary.${field} عدد معتبر نیست`,
    );
  }
  assert(
    VALID_STATUSES.has(summary.status),
    `${location}.summary.status معتبر نیست`,
  );

  const pricedRows = rows.filter((row) => row.price !== null);
  if (!pricedRows.length) {
    assert(
      summary.min === 0 && summary.max === 0 && summary.average === 0,
      `${location} بدون قیمت باید خلاصه صفر داشته باشد`,
    );
    return;
  }

  assert(summary.min > 0, `${location}.summary.min باید مثبت باشد`);
  assert(
    summary.max >= summary.min,
    `${location}.summary.max از min کمتر است`,
  );
  assert(
    summary.average >= summary.min && summary.average <= summary.max,
    `${location}.summary.average خارج از بازه است`,
  );

  // The summary must agree with the rows it summarises. Without this, a scraper
  // that rounds or rescales the numbers publishes prices that appear nowhere in
  // the table, and every check above still passes.
  const expected = deriveSummaryFromRows(pricedRows);
  assert(
    summary.min === expected.min,
    `${location}.summary.min با ارزان‌ترین ردیف (${expected.min}) برابر نیست: ${summary.min}`,
  );
  assert(
    summary.max === expected.max,
    `${location}.summary.max با گران‌ترین ردیف (${expected.max}) برابر نیست: ${summary.max}`,
  );
  assert(
    Math.abs(summary.average - expected.average) <= 1,
    `${location}.summary.average با میانگین ردیف‌ها (${expected.average}) همخوان نیست: ${summary.average}`,
  );
}

function validateCategory(category, location) {
  assert(isRecord(category), `${location} شیء نیست`);
  for (const field of ["id", "label", "groupingLabel", "specificationLabel"]) {
    assert(
      typeof category[field] === "string" && category[field].trim(),
      `${location}.${field} خالی است`,
    );
  }
  // sourceUrl is rendered straight into an href (unlike sourceHome, which
  // never reaches markup), so it gets the same scheme check as sourceHome
  // rather than just a non-empty-string check.
  assert(
    typeof category.sourceUrl === "string" &&
      /^https:\/\//.test(category.sourceUrl),
    `${location}.sourceUrl معتبر نیست`,
  );
  assert(Array.isArray(category.factories), `${location}.factories آرایه نیست`);
  assert(category.factories.length > 0, `${location}.factories خالی است`);

  const factoryNames = new Set();
  const rowIds = new Set();
  const rows = [];
  category.factories.forEach((factory, factoryIndex) => {
    const factoryLocation = `${location}.factories[${factoryIndex}]`;
    assert(isRecord(factory), `${factoryLocation} شیء نیست`);
    assert(
      typeof factory.name === "string" && factory.name.trim(),
      `${factoryLocation}.name خالی است`,
    );
    assert(
      !factoryNames.has(factory.name),
      `${location} گروه تکراری «${factory.name}» دارد`,
    );
    factoryNames.add(factory.name);
    assert(Array.isArray(factory.rows), `${factoryLocation}.rows آرایه نیست`);
    assert(factory.rows.length > 0, `${factoryLocation}.rows خالی است`);

    factory.rows.forEach((row, rowIndex) => {
      const rowLocation = `${factoryLocation}.rows[${rowIndex}]`;
      assert(isRecord(row), `${rowLocation} شیء نیست`);
      assert(
        Number.isSafeInteger(row.id) && row.id > 0,
        `${rowLocation}.id معتبر نیست`,
      );
      assert(
        !rowIds.has(row.id),
        `${location} شناسه ردیف تکراری ${row.id} دارد`,
      );
      rowIds.add(row.id);
      assert(
        typeof row.title === "string" && row.title.trim(),
        `${rowLocation}.title خالی است`,
      );
      for (const field of ["size", "unit", "factory"]) {
        assert(
          typeof row[field] === "string",
          `${rowLocation}.${field} رشته نیست`,
        );
      }
      assert(
        row.price === null ||
          (Number.isFinite(row.price) && Number(row.price) > 0),
        `${rowLocation}.price معتبر نیست`,
      );
      assert(
        Number.isFinite(row.percent),
        `${rowLocation}.percent معتبر نیست`,
      );
      assert(
        VALID_STATUSES.has(row.status),
        `${rowLocation}.status معتبر نیست`,
      );
      assert(
        Number.isFinite(row.updatedAt) && row.updatedAt >= 0,
        `${rowLocation}.updatedAt معتبر نیست`,
      );
      rows.push(row);
    });
  });

  assert(isRecord(category.filters), `${location}.filters وجود ندارد`);
  assert(
    Array.isArray(category.filters.factories),
    `${location}.filters.factories آرایه نیست`,
  );
  assert(
    Array.isArray(category.filters.sizes),
    `${location}.filters.sizes آرایه نیست`,
  );
  const filterFactories = new Set(category.filters.factories);
  assert(
    factoryNames.size === filterFactories.size &&
      [...factoryNames].every((name) => filterFactories.has(name)),
    `${location}.filters.factories با گروه‌ها همخوان نیست`,
  );
  const rowSizes = new Set(rows.map((row) => row.size).filter(Boolean));
  const filterSizes = new Set(category.filters.sizes);
  assert(
    rowSizes.size === filterSizes.size &&
      [...rowSizes].every((size) => filterSizes.has(size)),
    `${location}.filters.sizes با ردیف‌ها همخوان نیست`,
  );
  validateSummary(category.summary, location, rows);
}

function validateEnvelope(payload, location) {
  assert(isRecord(payload), `${location} شیء نیست`);
  assert(
    typeof payload.fetchedAt === "string" &&
      Number.isFinite(Date.parse(payload.fetchedAt)),
    `${location}.fetchedAt معتبر نیست`,
  );
  assert(
    typeof payload.sourceName === "string" && payload.sourceName.trim(),
    `${location}.sourceName خالی است`,
  );
  assert(
    typeof payload.sourceHome === "string" &&
      /^https:\/\//.test(payload.sourceHome),
    `${location}.sourceHome معتبر نیست`,
  );
  assert(
    Number.isFinite(payload.taxRate) &&
      payload.taxRate >= 0 &&
      payload.taxRate <= 1,
    `${location}.taxRate معتبر نیست`,
  );
}

export function validateCatalogSnapshot(
  payload,
  { expectedCatalogs } = {},
) {
  validateEnvelope(payload, "catalog");
  assert(Array.isArray(payload.catalogs), "catalog.catalogs آرایه نیست");
  assert(payload.catalogs.length > 0, "catalog.catalogs خالی است");
  const catalogIds = new Set();
  payload.catalogs.forEach((catalog, catalogIndex) => {
    const location = `catalog.catalogs[${catalogIndex}]`;
    assert(isRecord(catalog), `${location} شیء نیست`);
    assert(
      typeof catalog.id === "string" && catalog.id.trim(),
      `${location}.id خالی است`,
    );
    assert(!catalogIds.has(catalog.id), `شناسه کاتالوگ ${catalog.id} تکراری است`);
    catalogIds.add(catalog.id);
    assert(
      typeof catalog.label === "string" && catalog.label.trim(),
      `${location}.label خالی است`,
    );
    assert(
      typeof catalog.initialCategoryId === "string",
      `${location}.initialCategoryId معتبر نیست`,
    );
    assert(Array.isArray(catalog.categories), `${location}.categories آرایه نیست`);
    assert(catalog.categories.length > 0, `${location}.categories خالی است`);
    catalog.categories.forEach((category, categoryIndex) =>
      validateCategory(category, `${location}.categories[${categoryIndex}]`),
    );
    assert(
      catalog.categories.some(
        (category) => category.id === catalog.initialCategoryId,
      ),
      `${location}.initialCategoryId در دسته‌ها وجود ندارد`,
    );
  });

  if (expectedCatalogs) {
    assert(
      payload.catalogs.length === expectedCatalogs.length,
      "تعداد کاتالوگ‌ها با قرارداد منبع همخوان نیست",
    );
    expectedCatalogs.forEach((expected, index) => {
      const actual = payload.catalogs[index];
      assert(actual?.id === expected.id, `کاتالوگ ${expected.id} جابه‌جا شده است`);
      assert(
        actual.categories.length === expected.categoryIds.length &&
          expected.categoryIds.every(
            (id, categoryIndex) =>
              actual.categories[categoryIndex]?.id === id,
          ),
        `دسته‌های کاتالوگ ${expected.id} با قرارداد منبع همخوان نیست`,
      );
    });
  }
  return payload;
}

/** @deprecated Use validateCatalogSnapshot */
export function validateCatalogPriceData(payload, { expectedCategoryIds } = {}) {
  if (Array.isArray(payload?.catalogs)) {
    return validateCatalogSnapshot(payload);
  }
  validateEnvelope(payload, "catalog");
  assert(Array.isArray(payload.categories), "catalog.categories آرایه نیست");
  assert(payload.categories.length > 0, "catalog.categories خالی است");
  payload.categories.forEach((category, index) =>
    validateCategory(category, `catalog.categories[${index}]`),
  );
  if (expectedCategoryIds) {
    assert(
      payload.categories.length === expectedCategoryIds.length &&
        expectedCategoryIds.every(
          (id, index) => payload.categories[index]?.id === id,
        ),
      "ترتیب یا تعداد دسته‌ها با قرارداد منبع همخوان نیست",
    );
  }
  return payload;
}

/** @deprecated Use validateCatalogSnapshot */
export const validateProductPricePayload = validateCatalogSnapshot;

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

