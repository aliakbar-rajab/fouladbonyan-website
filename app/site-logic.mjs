/**
 * Convert Persian and Arabic digits to ASCII digits. Both blocks (U+06F0 and
 * U+0660) run 0-9 in order, so the digit's value is the low nibble.
 */
export function toAsciiDigits(value = "") {
  return String(value).replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) & 0xf),
  );
}

/**
 * Convert ASCII and Arabic-Indic digits to Persian digits. Both target blocks
 * run 0-9 in order, so each digit is a fixed offset from its source.
 */
export function toPersianDigits(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/[0-9]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 1728),
    )
    .replace(/[٠-٩]/g, (digit) =>
      String.fromCharCode(digit.charCodeAt(0) + 144),
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
