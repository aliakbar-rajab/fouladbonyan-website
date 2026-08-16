/**
 * Convert Persian and Arabic digits to ASCII digits. Both blocks (U+06F0 and
 * U+0660) run 0-9 in order, so the digit's value is the low nibble.
 */
export function toAsciiDigits(value = "") {
  return String(value).replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) & 0xf),
  );
}

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
 * @param {Array<{id:string,label:string,rows:Array<{product:string,origin:string,unit:string,categoryId?:string,factory?:string,size?:string,searchText?:string}>}>} groups
 * @param {string} query
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
