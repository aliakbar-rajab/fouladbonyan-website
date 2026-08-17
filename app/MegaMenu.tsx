import { useEffect, useRef, useState } from "react";
import { localizeCatalogValue } from "./catalog-utils";
import { loadGroupCatalog } from "./group-catalog";
import { productGroups, type ProductGroupId } from "./category-meta";
import type { CatalogViewRequest } from "./catalog-types";
import { CatalogLoadMessage } from "./site-ui";
import { useCatalogData } from "./use-catalog-data";
import { useMediaQuery } from "./use-media-query";

// Each group's own catalog supplies the menu's types, factories and sizes, so
// nothing here is a second copy of the price data.
const MAX_MENU_ENTRIES = 16;

type SelectView = (view: Omit<CatalogViewRequest, "requestId">) => void;

function MegaMenuSections({
  groupId,
  onSelect,
}: {
  groupId: ProductGroupId;
  onSelect: SelectView;
}) {
  const state = useCatalogData(loadGroupCatalog, groupId);

  if (state.status !== "ready") {
    return <CatalogLoadMessage status={state.status} subject="فهرست این گروه" />;
  }

  const catalog = state.data;
  const initialCategory =
    catalog.categories.find(
      (category) => category.id === catalog.initialCategoryId,
    ) ?? catalog.categories[0];
  if (!initialCategory) return null;

  return (
    <>
      <section className="mega-rebar-types">
        <p className="mega-group-label">انواع {catalog.label}</p>
        {catalog.categories.map((category) => (
          <button
            type="button"
            key={category.id}
            onClick={() => onSelect({ categoryId: category.id })}
          >
            قیمت {category.label}
          </button>
        ))}
      </section>

      <section className="mega-rebar-factories">
        <p className="mega-group-label">
          {initialCategory.groupingLabel}‌های {catalog.label}
        </p>
        <div>
          {initialCategory.filters.factories
            .slice(0, MAX_MENU_ENTRIES)
            .map((factory) => (
              <button
                type="button"
                key={factory}
                onClick={() =>
                  onSelect({ categoryId: initialCategory.id, factory })
                }
              >
                {catalog.label} {factory}
              </button>
            ))}
        </div>
      </section>

      <section className="mega-rebar-sizes">
        <p className="mega-group-label">سایزهای {catalog.label}</p>
        <div>
          {initialCategory.filters.sizes
            .slice(0, MAX_MENU_ENTRIES)
            .map((size) => (
              <button
                type="button"
                key={size}
                onClick={() =>
                  onSelect({ categoryId: initialCategory.id, size })
                }
              >
                {catalog.label} {localizeCatalogValue(size)}
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
          {productsOpen ? (
            <div
              id="product-navigation"
              className="product-dropdown rebar-mega-menu"
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
                      قیمت {group.label}
                    </a>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
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
