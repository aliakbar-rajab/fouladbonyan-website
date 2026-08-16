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
import { loadBeamPriceData, loadRebarPriceData } from "./catalog-data";
import RebarPrices, { type RebarViewRequest } from "./RebarPrices";
import BeamPrices, { type BeamViewRequest } from "./BeamPrices";
import ProductPrices from "./ProductPrices";
import {
  loadProductPricePayload,
  type ProductCatalogId,
  type ProductViewRequest,
} from "./product-price-data";
import {
  getInitialCategory,
  isProductCatalogId,
  productGroups,
  type ProductGroup,
  type ProductGroupId,
} from "./category-meta";
import { phones } from "./contact-data";
import { LightPillar } from "./LightPillar";
import { SiteFooter } from "./SiteFooter";
import { Brand, SectionTitle } from "./site-ui";
import { CategoryGrid } from "./CategoryGrid";
import { HeroCarousel } from "./HeroCarousel";
import { MarketPrices } from "./MarketPrices";
import { MegaMenu } from "./MegaMenu";
import { useMediaQuery } from "./use-media-query";

const loadCatalogSearchGroups = createRetryableLoader<ProductGroup[]>(() =>
  Promise.all([
    loadRebarPriceData(),
    loadBeamPriceData(),
    loadProductPricePayload(),
  ]).then(([rebar, beam, products]) =>
    buildCatalogSearchGroups(productGroups, { rebar, beam, products }),
  ),
);

function scrollToPrices(reduceMotion: boolean) {
  document.getElementById("prices")?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

export default function App() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(getInitialCategory);
  const [searchInput, setSearchInput] = useState("");
  const [committedSearch, setCommittedSearch] = useState("");
  const [searchMessage, setSearchMessage] = useState("");
  const [searchGroups, setSearchGroups] = useState<ProductGroup[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [rebarViewRequest, setRebarViewRequest] = useState<RebarViewRequest>({
    requestId: 0,
  });
  const [beamViewRequest, setBeamViewRequest] = useState<BeamViewRequest>({
    requestId: 0,
  });
  const [productViewRequest, setProductViewRequest] =
    useState<ProductViewRequest>({
      requestId: 0,
    });

  const isDirectCallDevice = useMediaQuery(
    "(max-width: 900px) and (hover: none) and (pointer: coarse)",
  );
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const contactHref = isDirectCallDevice ? phones[0].href : "#phone-numbers";
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const didAutoScrollCategoryRoute = useRef(false);
  const initialCategoryRoute = productGroups.some(
    (group) =>
      group.id ===
      document.getElementById("root")?.dataset.initialCategory,
  );

  useEffect(() => {
    if (!initialCategoryRoute || didAutoScrollCategoryRoute.current) return;
    didAutoScrollCategoryRoute.current = true;
    scrollToPrices(reduceMotion);
  }, [initialCategoryRoute, reduceMotion]);

  const filteredGroups = useMemo(
    () => filterProductGroups(searchGroups ?? productGroups, committedSearch),
    [committedSearch, searchGroups],
  );

  const visibleGroup =
    filteredGroups.find((group) => group.id === activeGroup) ??
    filteredGroups[0] ??
    null;
  const resetGroupView = (groupId: ProductGroupId) => {
    if (groupId === "rebar") {
      setRebarViewRequest((current) => ({
        requestId: current.requestId + 1,
        categoryId: "ribbed",
      }));
    } else if (groupId === "beam") {
      setBeamViewRequest((current) => ({
        requestId: current.requestId + 1,
        categoryId: "beam",
      }));
    } else if (isProductCatalogId(groupId)) {
      setProductViewRequest((current) => ({
        requestId: current.requestId + 1,
      }));
    }
  };

  const goToGroup = (groupId: ProductGroupId) => {
    setCommittedSearch("");
    setSearchInput("");
    setSearchMessage("");
    setActiveGroup(groupId);
    resetGroupView(groupId);
    setMobileNavOpen(false);
    scrollToPrices(reduceMotion);
  };

  const goToRebarView = (
    view: Omit<RebarViewRequest, "requestId">,
  ) => {
    setCommittedSearch("");
    setSearchInput("");
    setSearchMessage("");
    setActiveGroup("rebar");
    setRebarViewRequest((current) => ({
      ...view,
      requestId: current.requestId + 1,
    }));
    setMobileNavOpen(false);
    scrollToPrices(reduceMotion);
  };

  const goToBeamView = (view: Omit<BeamViewRequest, "requestId">) => {
    setCommittedSearch("");
    setSearchInput("");
    setSearchMessage("");
    setActiveGroup("beam");
    setBeamViewRequest((current) => ({
      ...view,
      requestId: current.requestId + 1,
    }));
    setMobileNavOpen(false);
    scrollToPrices(reduceMotion);
  };

  const goToProductView = (
    catalogId: ProductCatalogId,
    view: Omit<ProductViewRequest, "requestId">,
  ) => {
    setCommittedSearch("");
    setSearchInput("");
    setSearchMessage("");
    setActiveGroup(catalogId);
    setProductViewRequest((current) => ({
      ...view,
      requestId: current.requestId + 1,
    }));
    setMobileNavOpen(false);
    scrollToPrices(reduceMotion);
  };

  const submitSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchInput.trim();
    if (!query) {
      setCommittedSearch("");
      setSearchGroups(null);
      setActiveGroup(productGroups[0].id);
      resetGroupView(productGroups[0].id);
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
      const resultGroupId = results[0].id as ProductGroupId;
      const firstRow = results[0].rows[0];
      setActiveGroup(resultGroupId);
      if (resultGroupId === "rebar") {
        setRebarViewRequest((current) => ({
          requestId: current.requestId + 1,
          categoryId: firstRow.categoryId as RebarViewRequest["categoryId"],
          factory: firstRow.factory,
          size: firstRow.size,
        }));
      } else if (resultGroupId === "beam") {
        setBeamViewRequest((current) => ({
          requestId: current.requestId + 1,
          categoryId: firstRow.categoryId as BeamViewRequest["categoryId"],
          factory: firstRow.factory,
          size: firstRow.size,
        }));
      } else {
        setProductViewRequest((current) => ({
          requestId: current.requestId + 1,
          categoryId: firstRow.categoryId,
          factory: firstRow.factory,
          size: firstRow.size,
        }));
      }
      const count = results.reduce((sum, group) => sum + group.rows.length, 0);
      setSearchMessage(`${count.toLocaleString("fa-IR")} نتیجه برای «${query}» پیدا شد.`);
      } else {
        setSearchMessage(`نتیجه‌ای برای «${query}» پیدا نشد.`);
      }
      setSearchLoading(false);
    }
    scrollToPrices(reduceMotion);
  };

  const moveTabFocus = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let target: number;
    if (event.key === "ArrowLeft") target = (currentIndex + 1) % productGroups.length;
    else if (event.key === "ArrowRight") {
      target = (currentIndex - 1 + productGroups.length) % productGroups.length;
    } else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = productGroups.length - 1;
    else return;

    event.preventDefault();
    const group = productGroups[target];
    setCommittedSearch("");
    setSearchInput("");
    setActiveGroup(group.id);
    resetGroupView(group.id);
    tabRefs.current[target]?.focus();
  };

  const toggleMobileNav = () => {
    setMobileNavOpen((open) => !open);
  };

  const closeMobileNav = () => {
    setMobileNavOpen(false);
  };

  return (
    <div id="fb-site">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>

      <div className="utility-bar" id="top">
        <div className="shell utility-inner">
          <p>مشاوره و استعلام تلفنی محصولات فولادی</p>
          <div aria-label="شماره‌های تماس">
            {phones.map((phone) => (
              <a href={phone.href} key={phone.href} dir="ltr">
                {phone.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <header className="site-header">
        <LightPillar
          topColor="#f6b500"
          bottomColor="#000000"
          intensity={0.8}
          rotationSpeed={0.15}
          glowAmount={0.005}
          pillarWidth={5}
          pillarHeight={0.28}
          noiseIntensity={0.1}
          pillarRotation={-15}
          interactive={false}
          mixBlendMode="normal"
        />

        <div className="shell header-main">
          <Brand headerLogo />

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

          <a className="header-phone" href={contactHref}>
            <span aria-hidden="true">☎</span>
            <span>
              <small>تماس با واحد فروش</small>
              <b dir="ltr">{phones[0].label}</b>
            </span>
          </a>

          <button
            className="nav-toggle"
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="primary-navigation"
            onClick={toggleMobileNav}
          >
            <span aria-hidden="true">{mobileNavOpen ? "×" : "☰"}</span>
            <span className="sr-only">فهرست اصلی</span>
          </button>
        </div>

        <MegaMenu
          mobileOpen={mobileNavOpen}
          onMobileToggle={toggleMobileNav}
          onMobileClose={closeMobileNav}
          activeGroup={activeGroup}
          onSelectGroup={goToGroup}
          onSelectRebarView={goToRebarView}
          onSelectBeamView={goToBeamView}
          onSelectProductView={goToProductView}
        />
      </header>

      <main id="main-content">
        <HeroCarousel
          reduceMotion={reduceMotion}
          onGoToPrices={() => scrollToPrices(reduceMotion)}
        />

        <CategoryGrid onSelectGroup={goToGroup} />

        <MarketPrices />

        <section className="prices section" id="prices">
          <div className="shell">
            <SectionTitle
              eyebrow="قیمت روز بازار"
              title="قیمت روز آهن و فولاد"
              description="قیمت همه محصولات از مرجع بازار بروزرسانی می‌شود؛ قیمت قطعی، موجودی و زمان تحویل را با واحد فروش تأیید کنید."
            />

            <p className="search-status" role="status" aria-live="polite">
              {searchMessage}
              {committedSearch ? (
                <button
                  type="button"
                  onClick={() => {
                    setCommittedSearch("");
                    setSearchInput("");
                    setSearchGroups(null);
                    setSearchMessage("همه محصولات نمایش داده می‌شوند.");
                    setActiveGroup(productGroups[0].id);
                    resetGroupView(productGroups[0].id);
                  }}
                >
                  پاک‌کردن جست‌وجو
                </button>
              ) : null}
            </p>

            <div className="product-tabs-viewport">
              <div className="product-tabs" role="tablist" aria-label="گروه محصولات">
                {productGroups.map((group, index) => {
                  const selected = visibleGroup?.id === group.id;
                  // When a search leaves no group visible, every tab would
                  // otherwise get tabIndex -1 and the whole tablist would drop
                  // out of the tab order. Keep the first tab reachable instead.
                  const focusable = selected || (!visibleGroup && index === 0);
                  return (
                    <button
                      type="button"
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
                      onClick={() => {
                        goToGroup(group.id);
                      }}
                    >
                      {group.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {visibleGroup ? (
              <div
                className="product-panel"
                role="tabpanel"
                id={`panel-${visibleGroup.id}`}
                aria-labelledby={`tab-${visibleGroup.id}`}
                tabIndex={0}
              >
                {visibleGroup.id === "rebar" ? (
                  <RebarPrices
                    key={rebarViewRequest.requestId}
                    phoneHref={contactHref}
                    requestedView={rebarViewRequest}
                  />
                ) : visibleGroup.id === "beam" ? (
                  <BeamPrices
                    key={beamViewRequest.requestId}
                    phoneHref={contactHref}
                    requestedView={beamViewRequest}
                  />
                ) : isProductCatalogId(visibleGroup.id) ? (
                  <ProductPrices
                    key={`${visibleGroup.id}-${productViewRequest.requestId}`}
                    catalogId={visibleGroup.id}
                    phoneHref={contactHref}
                    requestedView={productViewRequest}
                  />
                ) : null}
              </div>
            ) : (
              <div className="empty-state" role="status">
                <h3>محصولی پیدا نشد</h3>
                <p>عبارت دیگری جست‌وجو کنید یا با واحد فروش تماس بگیرید.</p>
                <a href={phones[0].href} dir="ltr">
                  {phones[0].label}
                </a>
              </div>
            )}
          </div>
        </section>

        <section className="about section" id="about">
          <div className="shell about-grid">
            <div className="about-copy">
              <SectionTitle
                eyebrow="درباره بنیان فولاد داریا"
                title="از انتخاب محصول تا هماهنگی تحویل"
                description="بنیان فولاد داریا (با نام‌های فولاد بنیان داریا، بنیان فولاد و فولاد بنیان نیز شناخته می‌شود) برای معرفی محصولات، استعلام موجودی، مقایسه گزینه‌های تأمین و هماهنگی تحویل در کنار متقاضیان ساختمانی و صنعتی است."
              />
              <ul className="feature-list">
                <li>
                  <strong>استعلام شفاف</strong>
                  <span>قیمت نهایی پس از مشخص‌شدن نوع، ابعاد، مقدار و محل تحویل اعلام می‌شود.</span>
                </li>
                <li>
                  <strong>راهنمایی پیش از درخواست</strong>
                  <span>مشخصات محصول پیش از صدور پیش‌فاکتور با متقاضی مرور می‌شود.</span>
                </li>
                <li>
                  <strong>پیگیری هماهنگ</strong>
                  <span>هماهنگی موجودی و تحویل پس از استعلام از طریق واحد فروش انجام می‌شود.</span>
                </li>
              </ul>
              <a className="about-more-link" href="/about/">
                آشنایی بیشتر با بنیان فولاد داریا
              </a>
            </div>
          </div>
        </section>

        <section className="quote-section section" aria-labelledby="quote-heading">
          <div className="shell quote-inner">
            <div>
              <span>درخواست پیش‌فاکتور</span>
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

      <div className="mobile-actions" aria-label="اقدام‌های سریع">
        <a href={contactHref}>
          <span aria-hidden="true">☎</span>
          تماس
        </a>
        <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
      </div>
    </div>
  );
}
