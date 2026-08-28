import { toAsciiDigits, toPersianDigits } from "./persian-numbers.mjs";

export { toAsciiDigits, toPersianDigits };

export function normalizeSearchText(value = "") {
  return toAsciiDigits(value)
    .trim()
    .toLocaleLowerCase("fa")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ");
}

/**
 * Search all product groups and retain only groups containing matching rows.
 *
 * Generic in the group, because this only ever narrows the list it is given:
 * callers get back groups of the same shape they passed in.
 *
 * @template {{id:string,label:string,rows:Array<{product:string,origin:string,unit:string,categoryId?:string,factory?:string,size?:string,searchText?:string}>}} TGroup
 * @param {TGroup[]} groups
 * @param {string} query
 * @returns {TGroup[]}
 */
export function filterProductGroups(groups, query) {
  const needle = normalizeSearchText(query);
  if (!needle) return groups;

  return groups
    .map((group) => ({
      ...group,
      rows: group.rows.filter((row) =>
        normalizeSearchText(
          `${group.label} ${row.product} ${row.origin} ${row.unit} ${row.searchText ?? ""}`,
        ).includes(needle),
      ),
    }))
    .filter((group) => group.rows.length > 0);
}
