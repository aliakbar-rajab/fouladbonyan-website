import { useEffect, useState } from "react";

export type CatalogLoadState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

export type CatalogLoader<T, K extends string> = ((key: K) => Promise<T>) & {
  getCached: (key?: K) => T | undefined;
};

/**
 * Load a catalog snapshot for `key`, once per key. `load` must be a stable
 * (module-level) function -- it is a dependency, so an inline arrow would
 * restart the fetch on every render.
 */
export function useCatalogData<T, K extends string>(
  load: CatalogLoader<T, K>,
  key: K,
): CatalogLoadState<T> {
  const initialData = load.getCached(key);
  const [loaded, setLoaded] = useState<
    (CatalogLoadState<T> & { key: K }) | null
  >(() => (initialData !== undefined ? { key, status: "ready", data: initialData } : null));

  useEffect(() => {
    if (loaded?.key === key && loaded.status === "ready") return;
    let active = true;
    load(key)
      .then((data) => {
        if (active) setLoaded({ key, status: "ready", data });
      })
      .catch(() => {
        if (active) setLoaded({ key, status: "error" });
      });
    return () => {
      active = false;
    };
  }, [load, key, loaded]);

  // A key change reads as "loading" immediately (unless initial data exists for it),
  // without a second render pass to reset the state the effect is about to replace.
  if (loaded?.key === key) return loaded;
  if (initialData !== undefined) return { status: "ready", data: initialData };
  return { status: "loading" };
}

