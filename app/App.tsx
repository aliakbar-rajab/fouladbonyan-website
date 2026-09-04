import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import CatalogPrices from "./CatalogPrices";
import { CategoryOverview } from "./CategoryOverview";
import { SteelPriceOverview } from "./SteelPriceOverview";
import { productGroups, type ProductGroupId } from "./category-meta";
import { siteConfig } from "./site-config";
import { SiteFooter } from "./SiteFooter";
import { SectionTitle } from "./site-ui";
import { CategoryGrid } from "./CategoryGrid";
import { HeroCarousel } from "./HeroCarousel";
import { MarketPrices } from "./MarketPrices";
import { MegaMenu } from "./MegaMenu";
import { SiteHeader } from "./SiteHeader";
import { useMediaQuery } from "./use-media-query";
import { PhoneIcon } from "./icons";
import { KnowledgeSection } from "./KnowledgeSection";
import { QuoteCtaSection } from "./QuoteCtaSection";
import { useCatalogWorkspace } from "./catalog-search-coordinator";

function scrollToPriceWorkspace() {
  document.getElementById("price-workspace")?.scrollIntoView({
    behavior: "auto",
    block: "start",
  });
}

export default function App({
  initialCategory,
  initialSubcategory,
  initialSubcategoryLabel,
}: {
  initialCategory?: ProductGroupId;
  initialSubcategory?: string;
  initialSubcategoryLabel?: string;
} = {}) {
  const workspace = useCatalogWorkspace({
    initialCategory,
    initialSubcategory,
    initialSubcategoryLabel,
  });

  const [searchInput, setSearchInput] = useState("");

  const isDirectCallDevice = useMediaQuery(
    "(max-width: 900px) and (hover: none) and (pointer: coarse)",
  );
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const contactHref = isDirectCallDevice
    ? siteConfig.contact.phones[0].href
    : "#phone-numbers";
  const didAutoScrollCategoryRoute = useRef(false);

  useEffect(() => {
    if (!workspace.isCategoryRoute || didAutoScrollCategoryRoute.current) return;
    didAutoScrollCategoryRoute.current = true;
    scrollToPriceWorkspace();
  }, [workspace.isCategoryRoute]);

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await workspace.submitSearch(searchInput);
    if (!searchInput.trim()) {
      setSearchInput("");
    }
    scrollToPriceWorkspace();
  };

  const handleClearSearch = () => {
    setSearchInput("");
    workspace.clearSearch();
    scrollToPriceWorkspace();
  };

  return (
    <div id="fb-site">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <SiteHeader
        brandHref={workspace.brandHref}
        renderNav={({ closeMobileNav }) => (
          <MegaMenu
            onMobileClose={closeMobileNav}
            activeGroup={workspace.activeGroup}
          />
        )}
      />

      <main id="main-content">
        <HeroCarousel
          reduceMotion={reduceMotion}
          onGoToPrices={scrollToPriceWorkspace}
          categoryGroup={workspace.hero.categoryGroup}
          subcategory={workspace.hero.subcategory}
        />

        <MarketPrices />

        <section className="prices section" id="prices">
          <div className="shell">
            <SectionTitle
              title={workspace.heading.title}
              description={workspace.heading.description}
            />

            <div className="price-workspace" id="price-workspace">
              <div className="price-workspace-tools">
                <form className="site-search" role="search" onSubmit={submitSearch}>
                  <label className="sr-only" htmlFor="site-search">
                    جست‌وجوی محصول
                  </label>
                  <input
                    id="site-search"
                    type="search"
                    placeholder="جست‌وجوی میلگرد، ورق، تیرآهن و…"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                  <button
                    type="submit"
                    aria-label="جست‌وجو"
                    disabled={workspace.search.isSearching}
                  >
                    {workspace.search.isSearching ? "در حال جست‌وجو…" : "جست‌وجو"}
                  </button>
                </form>

                <p className="search-status" role="status" aria-live="polite">
                  {workspace.search.statusMessage}
                  {workspace.search.isActive ? (
                    <button type="button" onClick={handleClearSearch}>
                      پاک‌کردن جست‌وجو
                    </button>
                  ) : null}
                </p>

                <div className="product-select-mobile">
                  <label htmlFor="product-family-select">گروه محصول</label>
                  <select
                    id="product-family-select"
                    value={workspace.selectedTabId}
                    onChange={(event) => {
                      const groupId = event.target.value as ProductGroupId;
                      if (workspace.search.isActive) {
                        setSearchInput("");
                        workspace.selectGroup(groupId);
                        scrollToPriceWorkspace();
                        return;
                      }
                      window.location.assign(`/${groupId}/`);
                    }}
                  >
                    {productGroups.map((group) => (
                      <option value={group.id} key={group.id}>
                        {group.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="product-tabs-viewport">
                  <nav
                    className="product-tabs"
                    aria-label="گروه محصولات"
                  >
                    {productGroups.map((group) => {
                      const selected = group.id === workspace.selectedTabId;
                      return (
                        <a
                          href={`/${group.id}/`}
                          aria-current={
                            selected && workspace.isCategoryRoute
                              ? "page"
                              : undefined
                          }
                          key={group.id}
                          onClick={(event) => {
                            workspace.selectTab(group.id, event);
                            if (workspace.search.isActive) {
                              setSearchInput("");
                              scrollToPriceWorkspace();
                            }
                          }}
                        >
                          {group.shortLabel}
                        </a>
                      );
                    })}
                  </nav>
                </div>
              </div>

              {workspace.viewMode === "home-overview" && (
                <SteelPriceOverview phoneHref={contactHref} />
              )}

              {workspace.viewMode === "category-overview" && workspace.visibleGroup && (
                <div className="product-panel">
                  <CategoryOverview groupId={workspace.visibleGroup.id} />
                </div>
              )}

              {workspace.viewMode === "catalog" && workspace.visibleGroup && (
                <div className="product-panel">
                  <CatalogPrices
                    key={`${workspace.visibleGroup.id}-${workspace.activeViewRequest.requestId}`}
                    groupId={workspace.visibleGroup.id}
                    phoneHref={contactHref}
                    requestedView={workspace.activeViewRequest}
                  />
                </div>
              )}

              {workspace.viewMode === "empty" && (
                <div className="empty-state" role="status">
                  <h3>محصولی پیدا نشد</h3>
                  <p>عبارت دیگری جست‌وجو کنید یا با واحد فروش تماس بگیرید.</p>
                  <a href={siteConfig.contact.phones[0].href} dir="ltr">
                    {siteConfig.contact.phones[0].label}
                  </a>
                </div>
              )}
            </div>

            {workspace.viewMode === "home-overview" ? <CategoryGrid /> : null}
          </div>
        </section>

        <KnowledgeSection />

        <QuoteCtaSection />
      </main>

      <SiteFooter />

      <div className="mobile-actions" role="group" aria-label="اقدام‌های سریع">
        <a href={contactHref}>
          <PhoneIcon className="mobile-action-icon" />
          تماس
        </a>
        <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
      </div>
    </div>
  );
}
