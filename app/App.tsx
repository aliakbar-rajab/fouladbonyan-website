import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { filterProductGroups } from "./site-logic.mjs";
import { buildCatalogSearchGroups } from "./catalog-search.mjs";
import { createRetryableLoader } from "./catalog-cache";
import CatalogPrices from "./CatalogPrices";
import { SteelPriceOverview } from "./SteelPriceOverview";
import { initialCategoryIdOf, loadAllGroupCatalogs } from "./group-catalog";
import { isProductGroupId, readRouteRequest } from "./root-dataset";
import { nextRovingIndex } from "./roving-tabs";
import {
  getCategoryById,
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import type { CatalogViewRequest } from "./catalog-types";
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

const loadCatalogSearchGroups = createRetryableLoader<ProductGroup[]>(() =>
  loadAllGroupCatalogs().then((catalogs) =>
    buildCatalogSearchGroups(productGroups, catalogs),
  ),
);

/** The price section's heading copy, which follows how the route was reached. */
function priceSectionHeading(
  subcategoryLabel: string | undefined,
  categoryLabel: string | undefined,
) {
  if (subcategoryLabel) {
    return {
      title: `قیمت روز ${subcategoryLabel}`,
      description: `قیمت روز و مشخصات فنی ${subcategoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  if (categoryLabel) {
    return {
      title: `قیمت روز ${categoryLabel}`,
      description: `قیمت روز و مشخصات فنی انواع ${categoryLabel} از معتبرترین کارخانه‌ها. برای استعلام موجودی و قیمت قطعی با واحد فروش تماس بگیرید.`,
    };
  }
  return {
    title: "قیمت روز آهن‌آلات و مقاطع فولادی",
    description:
      "خلاصه قیمت روز همه دسته‌های فولادی بر اساس استعلام بازار. برای مشاهده مشخصات کامل روی هر گروه کلیک کنید.",
  };
}

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
  const route = readRouteRequest({
    category: initialCategory,
    subcategory: initialSubcategory,
    subcategoryLabel: initialSubcategoryLabel,
  });

  // `route.category` is already known to be a real group, so its presence is
  // what makes this a category route.
  const isCategoryRoute = Boolean(route.category);
  const [activeGroup, setActiveGroup] = useState<ProductGroupId>(
    () => route.category ?? productGroups[0].id,
  );
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [searchGroups, setSearchGroups] = useState<ProductGroup[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeViewRequest, setActiveViewRequest] = useState<CatalogViewRequest>(() => ({
    requestId: 0,
    categoryId:
      route.subcategory ??
      (route.category ? initialCategoryIdOf(route.category) : undefined),
  }));

  const isDirectCallDevice = useMediaQuery(
    "(max-width: 900px) and (hover: none) and (pointer: coarse)",
  );
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const contactHref = isDirectCallDevice
    ? siteConfig.contact.phones[0].href
    : "#phone-numbers";
  const tabRefs = useRef<Array<HTMLAnchorElement | HTMLButtonElement | null>>([]);
  const didAutoScrollCategoryRoute = useRef(false);

  const categoryGroup = route.category
    ? getCategoryById(route.category) ?? null
    : null;

  const subcategoryInfo = route.subcategory
    ? {
        id: route.subcategory,
        label: route.subcategoryLabel || route.subcategory,
      }
    : null;


  useEffect(() => {
    if (!isCategoryRoute || didAutoScrollCategoryRoute.current) return;
    didAutoScrollCategoryRoute.current = true;
    scrollToPrices(reduceMotion);
  }, [isCategoryRoute, reduceMotion]);


  // filterProductGroups only ever narrows the list it is given, so the result
  // is still the product groups it was built from.
  const filteredGroups: ProductGroup[] = useMemo(
    () => filterProductGroups(searchGroups ?? productGroups, committedSearch),
    [committedSearch, searchGroups],
  );

  const visibleGroup =
    filteredGroups.find((group) => group.id === activeGroup) ??
    filteredGroups[0] ??
    null;

  // A category route or a search shows whichever group is visible; the plain
  // homepage opens on the first group.
  const selectedTabId =
    isCategoryRoute || committedSearch ? visibleGroup?.id : productGroups[0].id;

  const heading = priceSectionHeading(
    subcategoryInfo?.label,
    isCategoryRoute
      ? (visibleGroup?.label ?? categoryGroup?.label ?? "محصول")
      : undefined,
  );

  const navigateToCatalog = (
    groupId: ProductGroupId,
    view?: Omit<CatalogViewRequest, "requestId">,
  ) => {
    setCommittedSearch("");
    setSearchInput("");
    setSearchMessage("");
    setActiveGroup(groupId);
    setActiveViewRequest((current) => ({
      requestId: current.requestId + 1,
      categoryId: view?.categoryId ?? initialCategoryIdOf(groupId),
      factory: view?.factory,
      size: view?.size,
    }));
    scrollToPrices(reduceMotion);
  };

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchInput.trim();
    if (!query) {
      setCommittedSearch("");
      setSearchGroups(null);
      navigateToCatalog(productGroups[0].id);
      setSearchMessage("همه محصولات نمایش داده می‌شوند.");
    } else {
      setSearchLoading(true);
      setSearchMessage(`در حال جست‌وجوی «${query}»…`);
      let groups: ProductGroup[];
      try {
        groups = await loadCatalogSearchGroups();
      } catch {
        // committedSearch is deliberately left alone: applying it while
        // searchGroups is still null filters the placeholder rows in
        // productGroups, which match nothing, so the whole price section would
        // collapse into "no products found" instead of showing this message.
        setSearchMessage(
          "دریافت فهرست زنده محصولات ممکن نشد. لطفاً دوباره تلاش کنید.",
        );
        setSearchLoading(false);
        return;
      }
      // Commit the query only now that the live rows it will be matched against
      // are available, so no render ever pairs a query with the placeholders.
      setSearchGroups(groups);
      setCommittedSearch(query);
      const results = filterProductGroups(groups, query);
      if (results.length > 0) {
        const resultGroupId = isProductGroupId(results[0].id)
          ? results[0].id
          : productGroups[0].id;
        const firstRow = results[0].rows[0];
        setActiveGroup(resultGroupId);
        setActiveViewRequest((current) => ({
          requestId: current.requestId + 1,
          categoryId: firstRow.categoryId,
          factory: firstRow.factory,
          size: firstRow.size,
        }));
        const count = results.reduce((sum, group) => sum + group.rows.length, 0);
        setSearchMessage(
          `${count.toLocaleString("fa-IR")} نتیجه برای «${query}» پیدا شد.`,
        );
      } else {
        setSearchMessage(`نتیجه‌ای برای «${query}» پیدا نشد.`);
      }
      setSearchLoading(false);
    }
    scrollToPrices(reduceMotion);
  };

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
    navigateToCatalog(productGroups[target].id);
    tabRefs.current[target]?.focus();
  };

  return (
    <div id="fb-site">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <SiteHeader
        brandHref={isCategoryRoute ? "/" : "#top"}
        renderNav={({ closeMobileNav }) => (
          <MegaMenu
            onMobileClose={closeMobileNav}
            activeGroup={activeGroup}
            onNavigate={navigateToCatalog}
          />
        )}
      />

      <main id="main-content">
        <HeroCarousel
          reduceMotion={reduceMotion}
          onGoToPrices={() => scrollToPrices(reduceMotion)}
          categoryGroup={categoryGroup}
          subcategory={subcategoryInfo}
        />

        <section className="prices section" id="prices">
          <div className="shell">
            <SectionTitle
              title={heading.title}
              description={heading.description}
            />

            <CategoryGrid
              activeGroup={activeGroup}
              onSelectGroup={navigateToCatalog}
            />

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
                disabled={searchLoading}
              >
                {searchLoading ? "در حال جست‌وجو…" : "جست‌وجو"}
              </button>
            </form>

            <p className="search-status" role="status" aria-live="polite">
              {searchMessage}
              {committedSearch ? (
                <button
                  type="button"
                  onClick={() => navigateToCatalog(productGroups[0].id)}
                >
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
                  const selected = group.id === selectedTabId;
                  const focusable =
                    selected ||
                    (!visibleGroup && index === 0) ||
                    (!isCategoryRoute && index === 0);
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
                        if (committedSearch) {
                          event.preventDefault();
                          navigateToCatalog(group.id);
                        }
                      }}
                    >
                      {group.shortLabel}
                    </a>
                  );
                })}
              </div>
            </div>

            {isCategoryRoute || committedSearch ? (
              visibleGroup ? (
                <div
                  className="product-panel"
                  role="tabpanel"
                  id={`panel-${visibleGroup.id}`}
                  aria-labelledby={`tab-${visibleGroup.id}`}
                  tabIndex={0}
                >
                  <CatalogPrices
                    key={`${visibleGroup.id}-${activeViewRequest.requestId}`}
                    groupId={visibleGroup.id}
                    phoneHref={contactHref}
                    requestedView={activeViewRequest}
                  />
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

        <MarketPrices />

        <section className="about section" id="about">
          <div className="shell about-grid">
            <div className="about-copy">
              <SectionTitle
                title="از انتخاب محصول تا هماهنگی تحویل"
                description="بنیان فولاد داریا مسیر بررسی مشخصات، استعلام موجودی، مقایسه گزینه‌های تأمین و هماهنگی تحویل را برای متقاضیان ساختمانی و صنعتی یکپارچه می‌کند."
              />
              <ul className="feature-list">
                <li>
                  <strong>استعلام شفاف</strong>
                  <span>
                    قیمت نهایی پس از مشخص‌شدن نوع، ابعاد، مقدار و محل تحویل
                    اعلام می‌شود.
                  </span>
                </li>
                <li>
                  <strong>راهنمایی پیش از درخواست</strong>
                  <span>
                    مشخصات محصول پیش از صدور پیش‌فاکتور با متقاضی مرور می‌شود.
                  </span>
                </li>
                <li>
                  <strong>پیگیری هماهنگ</strong>
                  <span>
                    هماهنگی موجودی و تحویل پس از استعلام از طریق واحد فروش انجام
                    می‌شود.
                  </span>
                </li>
              </ul>
              <a className="about-more-link" href="/about/">
                آشنایی بیشتر با بنیان فولاد داریا
              </a>
            </div>
          </div>
        </section>

        <section className="knowledge-section section" aria-labelledby="knowledge-heading">
          <div className="shell knowledge-layout">
            <div className="knowledge-intro">
              <h2 id="knowledge-heading">دانش فنی، پیش از استعلام</h2>
              <p>
                ابزارها و جدول‌های مرجع برای آماده‌کردن مشخصات خرید پیش از تماس
                با واحد فروش.
              </p>
            </div>
            <div className="knowledge-links">
              <a href="/guide/rebar-weight-chart/">
                <strong>جدول وزن میلگرد</strong>
                <span>بررسی قطر، طول و وزن تقریبی</span>
              </a>
              <a href="/guide/beam-weight-chart/">
                <strong>جدول وزن تیرآهن</strong>
                <span>مرجع وزن شاخه و سایز</span>
              </a>
              <a href="/guide/units-and-quote-specs/">
                <strong>واحدها و مشخصات استعلام</strong>
                <span>آماده‌سازی اطلاعات خرید</span>
              </a>
            </div>
          </div>
        </section>

        <section
          className="quote-section section"
          aria-labelledby="quote-heading"
        >
          <div className="shell quote-inner">
            <div>
              <h2 id="quote-heading">مشخصات محصول موردنیاز را آماده کنید</h2>
              <p>
                نوع محصول، ابعاد، مقدار و شهر مقصد را آماده کنید تا واحد فروش
                بتواند استعلام دقیق‌تری ارائه کند.
              </p>
            </div>
            <a href="/quote-process/#quote-form">تکمیل فرم پیش‌فاکتور</a>
          </div>
        </section>
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
