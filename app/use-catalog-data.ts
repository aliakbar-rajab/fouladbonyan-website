import { useEffect, useState } from "react";

export type CatalogLoadState<T> =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: T };

/**
 * Load a catalog snapshot for `key`, once per key. `load` must be a stable
 * (module-level) function -- it is a dependency, so an inline arrow would
 * restart the fetch on every render.
 */
export function useCatalogData<T, K extends string>(
  load: (key: K) => Promise<T>,
  key: K,
): CatalogLoadState<T> {
  const [loaded, setLoaded] = useState<
    (CatalogLoadState<T> & { key: K }) | null
  >(null);

  useEffect(() => {
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
  }, [load, key]);

  // A key change reads as "loading" immediately, without a second render pass
  // to reset the state the effect is about to replace.
  return loaded?.key === key ? loaded : { status: "loading" };
}
