/**
 * The single home of the catalog taxonomy: every product group's id, label
 * and initial category, and every subcategory's id and label, in the fixed
 * group and subcategory order the rest of the site relies on.
 *
 * This used to be written down three times — the scrape config
 * (scripts/price-catalog-config.mjs), the presentation metadata
 * (app/category-meta.ts), and the catalog reader's initial-category fallback
 * map (app/catalog-reader.ts) — and nothing checked the three copies against
 * each other, so a label or id could drift silently between them. This file
 * is now the one place ids, labels and initial categories are written down;
 * the other three compose from it instead of restating it.
 *
 * Kept dependency-free and `.mjs` (like catalog-pricing.mjs) so it can be
 * loaded by all three of: the browser bundle (Vite), the build scripts under
 * plain `node`, and the Cloudflare Worker (bundled by wrangler).
 */

/**
 * @typedef {{ id: string, label: string }} TaxonomySubcategory
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   initialCategoryId: string,
 *   subcategories: TaxonomySubcategory[],
 * }} TaxonomyGroup
 */

/** @type {TaxonomyGroup[]} */
export const catalogGroups = [
  {
    id: "rebar",
    label: "میلگرد",
    initialCategoryId: "ribbed",
    subcategories: [
      { id: "ribbed", label: "میلگرد آجدار" },
      { id: "simple", label: "میلگرد ساده" },
      { id: "stainless", label: "میلگرد استیل" },
      { id: "alloy", label: "میلگرد آلیاژی" },
    ],
  },
  {
    id: "beam",
    label: "تیرآهن",
    initialCategoryId: "beam",
    subcategories: [
      { id: "beam", label: "تیرآهن" },
      { id: "hash", label: "تیرآهن هاش" },
    ],
  },
  {
    id: "sheet",
    label: "ورق فولادی",
    initialCategoryId: "black-sheet",
    subcategories: [
      { id: "black-sheet", label: "ورق سیاه" },
      { id: "sheet-st52", label: "ورق ST52" },
      { id: "sheet-a283", label: "ورق A283" },
      { id: "sheet-a285", label: "ورق A285" },
      { id: "sheet-a516", label: "ورق A516" },
      { id: "steel-strip", label: "تسمه آهنی" },
      { id: "galvanized-sheet", label: "ورق گالوانیزه" },
      { id: "colored-sheet", label: "ورق رنگی" },
      { id: "oily-sheet", label: "ورق روغنی" },
      { id: "checkered-sheet", label: "ورق آجدار" },
      { id: "pickled-sheet", label: "ورق اسیدشویی" },
      { id: "decking-sheet", label: "عرشه فولادی" },
      { id: "stainless-sheet", label: "ورق استیل" },
      { id: "wear-resistant-sheet", label: "ورق ضد سایش" },
      { id: "sheet-ck45", label: "ورق CK45" },
    ],
  },
  {
    id: "profile",
    label: "قوطی و پروفیل",
    initialCategoryId: "box-profile",
    subcategories: [
      { id: "box-profile", label: "قوطی و پروفیل" },
      { id: "building-profile", label: "پروفیل ساختمانی" },
      { id: "industrial-profile", label: "پروفیل صنعتی" },
      { id: "stainless-profile", label: "پروفیل استیل" },
      { id: "furniture-profile", label: "پروفیل مبلی" },
      { id: "galvanized-profile", label: "پروفیل گالوانیزه" },
      { id: "z-profile", label: "پروفیل Z" },
    ],
  },
  {
    id: "pipe",
    label: "لوله فولادی",
    initialCategoryId: "scaffold-pipe",
    subcategories: [
      { id: "scaffold-pipe", label: "لوله داربست" },
      { id: "galvanized-pipe", label: "لوله گالوانیزه" },
      { id: "stainless-pipe", label: "لوله استیل" },
      { id: "water-test-pipe", label: "لوله تست آب" },
      { id: "spiral-pipe", label: "لوله اسپیرال" },
      { id: "api-pipe", label: "لوله API" },
      { id: "gas-pipe", label: "لوله گاز" },
      { id: "well-casing-pipe", label: "لوله جدار چاه" },
      { id: "seamless-pipe", label: "لوله مانیسمان" },
      { id: "thick-wall-pipe", label: "لوله گوشتدار" },
    ],
  },
  {
    id: "angle",
    label: "نبشی",
    initialCategoryId: "angle",
    subcategories: [{ id: "angle", label: "نبشی" }],
  },
  {
    id: "channel",
    label: "ناودانی",
    initialCategoryId: "channel",
    subcategories: [{ id: "channel", label: "ناودانی" }],
  },
  {
    id: "wire",
    label: "مفتول و سیم",
    initialCategoryId: "wire",
    subcategories: [
      { id: "wire", label: "سیم مفتول" },
      { id: "rib-lath", label: "رابیتس" },
      { id: "steel-mesh", label: "مش" },
      { id: "chicken-mesh", label: "توری مرغی" },
      { id: "chain-link-mesh", label: "توری حصاری" },
      { id: "crimped-mesh", label: "توری پرسی" },
    ],
  },
];

/**
 * The flat `{ id: label }` map of every subcategory across every group,
 * derived from catalogGroups rather than retyped.
 * @type {Record<string, string>}
 */
export const subcategoryLabels = Object.fromEntries(
  catalogGroups.flatMap((group) =>
    group.subcategories.map((subcategory) => [
      subcategory.id,
      subcategory.label,
    ]),
  ),
);

/**
 * @param {string} groupId
 * @returns {string | undefined}
 */
export function groupLabel(groupId) {
  return catalogGroups.find((group) => group.id === groupId)?.label;
}

/**
 * @param {string} subcategoryId
 * @returns {string | undefined}
 */
export function subcategoryLabel(subcategoryId) {
  return subcategoryLabels[subcategoryId];
}

/**
 * The category a group opens on.
 * @param {string} groupId
 * @returns {string | undefined}
 */
export function initialCategoryIdOf(groupId) {
  return catalogGroups.find((group) => group.id === groupId)
    ?.initialCategoryId;
}
