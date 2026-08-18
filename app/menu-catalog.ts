/**
 * The mega menu's own slice of the catalogs.
 *
 * MegaMenuSections used to read the *full* price snapshot through
 * loadGroupCatalog. That made its markup depend on whether the visited page
 * happened to embed the snapshot for the menu's default group (rebar): the
 * prerender always had it cached, the browser usually did not, and React
 * hydrated a populated <section> against a "loading" <p> -- error #418.
 *
 * The menu never needed prices. It needs labels, one category list, and the
 * first MAX_MENU_ENTRIES factories and sizes of the group's initial category.
 * That is a few kilobytes, so the build embeds it on every page that renders
 * <App /> and the client seeds it before hydrating. Server and client then
 * render the same markup on every route, by construction.
 */
import { productGroups, type ProductGroupId } from "./category-meta";
import { loadGroupCatalog, type GroupCatalog } from "./group-catalog";

// Each group's own catalog supplies the menu's types, factories and sizes, so
// nothing here is a second copy of the price data.
const MAX_MENU_ENTRIES = 16;

export type MenuGroup = {
  id: ProductGroupId;
  label: string;
  initialCategoryId: string;
  groupingLabel: string;
  categories: { id: string; label: string }[];
  factories: string[];
  sizes: string[];
};

export type MenuCatalog = MenuGroup[];

function toMenuGroup(
  groupId: ProductGroupId,
  catalog: GroupCatalog,
): MenuGroup | null {
  const initialCategory =
    catalog.categories.find(
      (category) => category.id === catalog.initialCategoryId,
    ) ?? catalog.categories[0];
  if (!initialCategory) return null;

  return {
    id: groupId,
    label: catalog.label,
    initialCategoryId: initialCategory.id,
    groupingLabel: initialCategory.groupingLabel,
    categories: catalog.categories.map((category) => ({
      id: category.id,
      label: category.label,
    })),
    factories: initialCategory.filters.factories.slice(0, MAX_MENU_ENTRIES),
    sizes: initialCategory.filters.sizes.slice(0, MAX_MENU_ENTRIES),
  };
}

/**
 * Built once per build from the primed catalog caches. The dev server has no
 * prerender step, so the same function also backs the async fallback below --
 * one derivation, not two.
 */
export async function buildMenuCatalog(): Promise<MenuCatalog> {
  const groups = await Promise.all(
    productGroups.map(async (group) =>
      toMenuGroup(group.id, await loadGroupCatalog(group.id)),
    ),
  );
  return groups.filter((group): group is MenuGroup => group !== null);
}

let cachedMenuCatalog: MenuCatalog | null = null;

export function setMenuCatalog(catalog: MenuCatalog) {
  cachedMenuCatalog = catalog;
}

/**
 * Loader shaped for useCatalogData. `getCached` is the only path that runs
 * during prerender and hydration; the async body exists for `npm run dev`,
 * which mounts with createRoot and so cannot produce a mismatch.
 */
export const loadMenuGroup = Object.assign(
  async (groupId: ProductGroupId): Promise<MenuGroup> => {
    const menuGroup = toMenuGroup(groupId, await loadGroupCatalog(groupId));
    if (!menuGroup) {
      throw new Error(`فهرست گروه ${groupId} در دسترس نیست.`);
    }
    return menuGroup;
  },
  {
    getCached: (groupId?: ProductGroupId): MenuGroup | undefined =>
      groupId
        ? (cachedMenuCatalog?.find((group) => group.id === groupId) ?? undefined)
        : undefined,
  },
);
