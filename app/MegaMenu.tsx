import { useEffect, useRef, useState } from "react";
import { localizeCatalogValue } from "./catalog-utils";
import {
  productGroups,
  subcategoryHref,
  type ProductGroupId,
} from "./category-meta";
import { primaryNavLinks } from "./site-config";
import { loadMenuGroup } from "./catalog-reader";
import { CatalogLoadMessage } from "./site-ui";
import { ChevronDownIcon } from "./icons";
import { useCatalogData } from "./use-catalog-data";

/*
 * Driven by the small menu payload (see catalog-reader.ts), never by the price
 * snapshots. The build embeds that payload on every page rendering <App />, and
 * static-entry/main.tsx seeds it before hydrateRoot, so this subtree renders
 * identically on the server and on the client for every route.
 *
 * Every link here is a real navigation, on purpose: a subcategory has its own
 * prerendered page, so following its href is what keeps the URL, <title>,
 * breadcrumb and visible catalog in agreement. A factory or size has no page
 * of its own, so it links to its group's initial category page instead, with
 * the pick carried as a `?factory=`/`?size=` query param that App reads once
 * on mount (see App.tsx) to seed the filter -- still a real navigation, just
 * to the nearest page that exists.
 */
function MegaMenuSections({ groupId }: { groupId: ProductGroupId }) {
  const state = useCatalogData(loadMenuGroup, groupId);

  if (state.status !== "ready") {
    return <CatalogLoadMessage status={state.status} subject="فهرست این گروه" />;
  }

  const group = state.data;
  // A factory or size has no page of its own, so its link lands on the group's
  // initial subcategory page -- which for a single-subcategory group is the
  // category URL itself. subcategoryHref owns that collapse.
  const filterBaseHref = subcategoryHref(groupId, group.initialCategoryId);
  const filterHref = (param: "factory" | "size", value: string) =>
    `${filterBaseHref}?${param}=${encodeURIComponent(value)}`;

  return (
    <>
      <section className="mega-rebar-types" aria-label={`انواع ${group.label}`}>
        <p className="mega-group-label">انواع {group.label}</p>
        {group.categories.map((category) => (
          <a
            href={subcategoryHref(groupId, category.id)}
            key={category.id}
          >
            {`قیمت ${category.label}`}
          </a>
        ))}
      </section>


      <section
        className="mega-rebar-factories"
        aria-label={`${group.groupingLabel}‌های ${group.label}`}
      >
        <p className="mega-group-label">
          {group.groupingLabel}‌های {group.label}
        </p>
        <div>
          {group.factories.map((factory) => (
            <a
              href={filterHref("factory", factory)}
              key={factory}
            >
              {group.label} {factory}
            </a>
          ))}
        </div>
      </section>

      <section className="mega-rebar-sizes" aria-label={`سایزهای ${group.label}`}>
        <p className="mega-group-label">سایزهای {group.label}</p>
        <div>
          {group.sizes.map((size) => (
            <a
              href={filterHref("size", size)}
              key={size}
            >
              {group.label} {localizeCatalogValue(size)}
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

type MegaMenuProps = {
  onMobileClose: () => void;
  activeGroup: ProductGroupId;
};

/*
 * The flat links are siteConfig.primaryNavLinks, in its order, so this shell
 * cannot rename a destination the other shells use -- /#prices read
 * "راهنمای استعلام" here while PrimaryNav and the footer called the same href
 * "قیمت روز آهن و فولاد", which is exactly the drift that config exists to
 * prevent. The products dropdown stands in for the /#products entry: it is a
 * disclosure button rather than a link, and it drills into the same
 * destinations that anchor reaches.
 */
const productsEntryIndex = primaryNavLinks.findIndex(
  (link) => link.href === "/#products",
);
const navLinksBeforeProducts = primaryNavLinks.slice(0, productsEntryIndex);
const navLinksAfterProducts = primaryNavLinks.slice(productsEntryIndex + 1);

export function MegaMenu({ onMobileClose, activeGroup }: MegaMenuProps) {
  const [productsOpen, setProductsOpen] = useState(false);
  const [megaProduct, setMegaProduct] = useState<ProductGroupId>(
    () => activeGroup ?? "rebar",
  );

  /*
   * While the panel is shut, the group it shows is not a choice anyone has
   * made yet -- it is just the group of the page you are on. That was kept in
   * sync by an effect that called setMegaProduct whenever the panel was
   * closed, which is a render triggering a second render to copy a prop into
   * state (react-hooks/set-state-in-effect). Derive it instead: `megaProduct`
   * now only holds a pick made *inside* an open panel, and a closed panel
   * always reads straight from `activeGroup`.
   */
  const shownProduct = productsOpen ? megaProduct : (activeGroup ?? "rebar");

  const productMenuRef = useRef<HTMLDivElement>(null);
  const productTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!productsOpen) return undefined;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!productMenuRef.current?.contains(event.target as Node)) {
        setProductsOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The panel is about to be hidden. If focus is still inside it, it would
      // land on <body> and the keyboard user would lose their place, so hand it
      // back to the trigger -- but only then, since this listener is on the
      // document and Escape may well have been pressed somewhere else.
      const focusWasInsideMenu = productMenuRef.current?.contains(
        document.activeElement,
      );
      setProductsOpen(false);
      if (focusWasInsideMenu) productTriggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [productsOpen]);

  return (
    <nav className="primary-nav" id="primary-navigation" aria-label="فهرست اصلی">
      {navLinksBeforeProducts.map((link) => (
        <a key={link.href} href={link.href} onClick={onMobileClose}>
          {link.label}
        </a>
      ))}
      <div className="products-menu" ref={productMenuRef}>
        <button
          type="button"
          ref={productTriggerRef}
          aria-expanded={productsOpen}
          aria-controls="product-navigation"
          onClick={() => {
            const nextOpen = !productsOpen;
            if (nextOpen) setMegaProduct(activeGroup);
            setProductsOpen(nextOpen);
          }}
        >
          قیمت روز محصولات
          <ChevronDownIcon />
        </button>
        <div
          id="product-navigation"
          className="product-dropdown rebar-mega-menu"
          hidden={!productsOpen}
        >
          <MegaMenuSections groupId={shownProduct} />

          <section className="mega-other-products" aria-label="گروه محصولات">
            <p className="mega-group-label">گروه محصولات</p>
            <div>
              {productGroups.map((group) => (
                <a
                  href={`/${group.id}/`}
                  key={group.id}
                  className={`mega-group-link${shownProduct === group.id ? " is-active" : ""}`}
                  aria-current={shownProduct === group.id ? "true" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    setMegaProduct(group.id);
                  }}
                >
                  {`قیمت ${group.label}`}
                </a>

              ))}
            </div>
          </section>
        </div>

      </div>
      {navLinksAfterProducts.map((link) => (
        <a key={link.href} href={link.href} onClick={onMobileClose}>
          {link.label}
        </a>
      ))}
    </nav>
  );
}
