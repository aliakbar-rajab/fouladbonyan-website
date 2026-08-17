import { useEffect, useRef, useState } from "react";
import { localizeCatalogValue } from "./catalog-utils";
import { productGroups, type ProductGroupId } from "./category-meta";
import type { CatalogViewRequest } from "./catalog-types";
import { loadMenuGroup } from "./menu-catalog";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";
import { useMediaQuery } from "./use-media-query";

type SelectView = (view: Omit<CatalogViewRequest, "requestId">) => void;

/*
 * Driven by the small menu payload (see menu-catalog.ts), never by the price
 * snapshots. The build embeds that payload on every page rendering <App />, and
 * static-entry/main.tsx seeds it before hydrateRoot, so this subtree renders
 * identically on the server and on the client for every route.
 */
function MegaMenuSections({
  groupId,
  onSelect,
}: {
  groupId: ProductGroupId;
  onSelect: SelectView;
}) {
  const state = useCatalogData(loadMenuGroup, groupId);

  if (state.status !== "ready") {
    return <CatalogLoadMessage status={state.status} subject="فهرست این گروه" />;
  }

  const group = state.data;

  return (
    <>
      <section className="mega-rebar-types">
        <p className="mega-group-label">انواع {group.label}</p>
        {group.categories.map((category) => (
          <a
            href={`/${groupId}/${category.id}/`}
            key={category.id}
            onClick={(event) => {
              event.preventDefault();
              onSelect({ categoryId: category.id });
            }}
          >
            {`قیمت ${category.label}`}
          </a>

        ))}
      </section>


      <section className="mega-rebar-factories">
        <p className="mega-group-label">
          {group.groupingLabel}‌های {group.label}
        </p>
        <div>
          {group.factories.map((factory) => (
            <button
              type="button"
              key={factory}
              onClick={() =>
                onSelect({ categoryId: group.initialCategoryId, factory })
              }
            >
              {group.label} {factory}
            </button>
          ))}
        </div>
      </section>

      <section className="mega-rebar-sizes">
        <p className="mega-group-label">سایزهای {group.label}</p>
        <div>
          {group.sizes.map((size) => (
            <button
              type="button"
              key={size}
              onClick={() =>
                onSelect({ categoryId: group.initialCategoryId, size })
              }
            >
              {group.label} {localizeCatalogValue(size)}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

type MegaMenuProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
  activeGroup: ProductGroupId;
  onNavigate: (
    groupId: ProductGroupId,
    view?: Omit<CatalogViewRequest, "requestId">,
  ) => void;
};

export function MegaMenu({
  mobileOpen,
  onMobileClose,
  activeGroup,
  onNavigate,
}: MegaMenuProps) {
  const [productsOpen, setProductsOpen] = useState(false);
  const [megaProduct, setMegaProduct] = useState<ProductGroupId>("rebar");

  const isMobile = useMediaQuery("(max-width: 900px)");
  const productMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!productsOpen) return undefined;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!productMenuRef.current?.contains(event.target as Node)) {
        setProductsOpen(false);
      }
    };
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setProductsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [productsOpen]);

  const selectView: SelectView = (view) => {
    onNavigate(megaProduct, view);
    setProductsOpen(false);
    onMobileClose();
  };

  return (
    <div className="nav-wrap">
      <nav
        className="shell primary-nav"
        id="primary-navigation"
        aria-label="فهرست اصلی"
        hidden={isMobile && !mobileOpen}
      >
        <a href="/" onClick={onMobileClose}>
          صفحه اصلی
        </a>
        <div className="products-menu" ref={productMenuRef}>
          <button
            type="button"
            aria-expanded={productsOpen}
            aria-controls="product-navigation"
            onClick={() => {
              const nextOpen = !productsOpen;
              if (nextOpen) setMegaProduct(activeGroup);
              setProductsOpen(nextOpen);
            }}
          >
            قیمت روز محصولات <span aria-hidden="true">⌄</span>
          </button>
          <div
            id="product-navigation"
            className="product-dropdown rebar-mega-menu"
            hidden={!productsOpen}
          >
            <MegaMenuSections groupId={megaProduct} onSelect={selectView} />

            <section className="mega-other-products">
              <p className="mega-group-label">گروه محصولات</p>
              <div>
                {productGroups.map((group) => (
                  <a
                    href={`/${group.id}/`}
                    key={group.id}
                    className={`mega-group-link${megaProduct === group.id ? " is-active" : ""}`}
                    aria-pressed={megaProduct === group.id}
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
        <a href="#prices" onClick={onMobileClose}>
          راهنمای استعلام
        </a>
        <a href="/about/" onClick={onMobileClose}>
          درباره ما
        </a>
        <a href="/contact/" onClick={onMobileClose}>
          تماس با ما
        </a>
        <a className="nav-quote" href="/quote-process/#quote-form">
          درخواست پیش‌فاکتور
        </a>
      </nav>
    </div>
  );
}
