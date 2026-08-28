import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import CatalogPrices from "./CatalogPrices";
import { CategoryOverview } from "./CategoryOverview";
import { SteelPriceOverview } from "./SteelPriceOverview";
import { nextRovingIndex } from "./catalog-utils";
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

function scrollToPrices(reduceMotion: boolean) {
  document.getElementById("prices")?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
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
  const tabRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const didAutoScrollCategoryRoute = useRef(false);

  useEffect(() => {
    if (!workspace.isCategoryRoute || didAutoScrollCategoryRoute.current) return;
    didAutoScrollCategoryRoute.current = true;
    scrollToPrices(reduceMotion);
  }, [workspace.isCategoryRoute, reduceMotion]);

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await workspace.submitSearch(searchInput);
    if (!searchInput.trim()) {
      setSearchInput("");
    }
    scrollToPrices(reduceMotion);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    workspace.clearSearch();
    scrollToPrices(reduceMotion);
  };

  // Roving-tabindex focus only: this tablist is a set of real links (see the
  // render below), so arrow keys must behave like Tab/Shift+Tab and merely
  // move focus. Committing to a tab is left to the browser's own Enter/click
  // activation of the now-focused <a>, the same path a mouse click uses --
  // otherwise the visible catalog could switch without the URL, <title>, or
  // metadata following it.
  const moveTabFocus = (
    event: ReactKeyboardEvent<HTMLElement>,
    currentIndex: number,
  ) => {
    const target = nextRovingIndex(
      event.key,
      currentIndex,
      productGroups.length,
    );
    if (target === null) return;

    event.preventDefault();
    tabRefs.current[target]?.focus();
  };

  return (
    <div id="fb-site">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <SiteHeader
        brandHref={workspace.isCategoryRoute ? "/" : "#top"}
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
          onGoToPrices={() => scrollToPrices(reduceMotion)}
          categoryGroup={workspace.categoryGroup}
          subcategory={workspace.subcategoryInfo}
        />

        <MarketPrices />

        <section className="prices section" id="prices">
          <div className="shell">
            <SectionTitle
              title={workspace.heading.title}
              description={workspace.heading.description}
            />

            <CategoryGrid activeGroup={workspace.activeGroup} />

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
                disabled={workspace.isSearching}
              >
                {workspace.isSearching ? "در حال جست‌وجو…" : "جست‌وجو"}
              </button>
            </form>

            <p className="search-status" role="status" aria-live="polite">
              {workspace.searchStatusMessage}
              {workspace.isSearchActive ? (
                <button type="button" onClick={handleClearSearch}>
                  پاک‌کردن جست‌وجو
                </button>
              ) : null}
            </p>

            <div className="product-tabs-viewport">
              <div
                className="product-tabs"
                role="tablist"
                aria-label="گروه محصولات"
              >
                {productGroups.map((group, index) => {
                  const selected = group.id === workspace.selectedTabId;
                  const focusable =
                    selected ||
                    (!workspace.visibleGroup && index === 0) ||
                    (!workspace.isCategoryRoute && index === 0);
                  return (
                    <a
                      href={`/${group.id}/`}
                      role="tab"
                      id={`tab-${group.id}`}
                      aria-selected={selected}
                      aria-controls={`panel-${group.id}`}
                      tabIndex={focusable ? 0 : -1}
                      key={group.id}
                      ref={(node) => {
                        tabRefs.current[index] = node;
                      }}
                      onKeyDown={(event) => moveTabFocus(event, index)}
                      onClick={(event) => {
                        workspace.handleTabClick(group.id, event);
                        if (workspace.isSearchActive) {
                          setSearchInput("");
                          scrollToPrices(reduceMotion);
                        }
                      }}
                    >
                      {group.shortLabel}
                    </a>
                  );
                })}
              </div>
            </div>

            {workspace.isCategoryRoute || workspace.isSearchActive ? (
              workspace.visibleGroup ? (
                <div
                  className="product-panel"
                  role="tabpanel"
                  id={`panel-${workspace.visibleGroup.id}`}
                  aria-labelledby={`tab-${workspace.visibleGroup.id}`}
                  tabIndex={0}
                >
                  {workspace.isCategoryOverviewRoute && !workspace.isSearchActive ? (
                    <CategoryOverview groupId={workspace.visibleGroup.id} />
                  ) : (
                    <CatalogPrices
                      key={`${workspace.visibleGroup.id}-${workspace.activeViewRequest.requestId}`}
                      groupId={workspace.visibleGroup.id}
                      phoneHref={contactHref}
                      requestedView={workspace.activeViewRequest}
                    />
                  )}
                </div>
              ) : (
                <div className="empty-state" role="status">
                  <h3>محصولی پیدا نشد</h3>
                  <p>عبارت دیگری جست‌وجو کنید یا با واحد فروش تماس بگیرید.</p>
                  <a href={siteConfig.contact.phones[0].href} dir="ltr">
                    {siteConfig.contact.phones[0].label}
                  </a>
                </div>
              )
            ) : (
              <SteelPriceOverview phoneHref={contactHref} />
            )}
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
