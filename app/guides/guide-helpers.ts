import { formatCatalogNumber as fa } from "../catalog-utils";
import { toPersianDigits } from "../persian-numbers.mjs";
import type { CatalogProfile, GuideReference } from "../steel-reference";

export { fa };

/** Fixed precision, so a numeric column stays aligned down its whole length. */
export const faFixed = (value: number, digits: number) =>
  value.toLocaleString("fa-IR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export const list = (values: string[]) => toPersianDigits(values.join("، "));

export const sizeRange = (sizes: string[]) =>
  sizes.length > 1
    ? `${toPersianDigits(sizes[0])} تا ${toPersianDigits(sizes[sizes.length - 1])}`
    : toPersianDigits(sizes[0] ?? "—");

export const findProfile = (
  reference: GuideReference,
  groupId: string,
  id: string,
): CatalogProfile | undefined =>
  reference.profiles.find(
    (profile) => profile.groupId === groupId && profile.id === id,
  );

export function profileRow(
  label: string,
  profiles: (CatalogProfile | undefined)[],
  read: (profile: CatalogProfile) => string,
) {
  return {
    label,
    values: profiles.map((profile) => (profile ? read(profile) : "—")),
  };
}
