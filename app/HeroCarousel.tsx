import { QUOTE_FORM_HREF } from "./quote-handoff";
import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
} from "react";
import { productGroups, type ProductGroup } from "./category-meta";
import { Breadcrumb } from "./Breadcrumb";
import { pageBreadcrumb } from "./site-page";
import { getHeroImageSources } from "./image-utils";
import { ArrowIcon } from "./icons";
import {
  carouselReducer,
  initialCarouselState,
  type CarouselAction,
} from "./hero-carousel-state";

const heroSlides = productGroups.slice(0, 3);
const HERO_SLIDE_INTERVAL_MS = 9_000;

/**
 * "ready" once the photo has loaded and decoded, "failed" if it is broken.
 * decode() can also reject for an image that did load (a decode abandoned
 * under memory pressure), so only a zero-width completed image is a failure.
 * Where decode() is missing (jsdom), the load and error events decide.
 */
function whenPhotoSettles(img: HTMLImageElement): Promise<"ready" | "failed"> {
  const outcome = () =>
    img.complete && img.naturalWidth === 0 ? "failed" : "ready";
  if (typeof img.decode === "function") {
    return img.decode().then(() => "ready" as const, outcome);
  }
  if (img.complete) return Promise.resolve(outcome());
  return new Promise((resolve) => {
    img.addEventListener("load", () => resolve("ready"), { once: true });
    img.addEventListener("error", () => resolve("failed"), { once: true });
  });
}

function subscribeToPageLoad(callback: () => void) {
  window.addEventListener("load", callback);
  return () => window.removeEventListener("load", callback);
}

/** True once the window `load` event has fired; false in the prerender. */
function usePageLoaded() {
  return useSyncExternalStore(
    subscribeToPageLoad,
    () => document.readyState === "complete",
    () => false,
  );
}

export type SubcategoryHeroInfo = {
  id: string;
  label: string;
};

type HeroCarouselProps = {
  reduceMotion: boolean;
  onGoToPrices: () => void;
  categoryGroup?: ProductGroup | null;
  subcategory?: SubcategoryHeroInfo | null;
};

export function HeroCarousel({
  reduceMotion,
  onGoToPrices,
  categoryGroup,
  subcategory,
}: HeroCarouselProps) {
  const [carousel, dispatch] = useReducer(
    carouselReducer,
    heroSlides.length,
    initialCarouselState,
  );
  const activeSlide = carousel.active;
  const pageLoaded = usePageLoaded();
  /*
   * Two separate reasons to hold the carousel, because they are not the same
   * promise. Hovering or focusing the hero suspends it for as long as the
   * pointer or focus is there; pressing the pause button stops it until the
   * visitor says otherwise. Sharing one flag let a mouse leaving the hero
   * silently restart a carousel the visitor had explicitly paused -- and flip
   * the button's own aria-pressed back with it.
   */
  const [userPaused, setUserPaused] = useState(false);
  const [hoverPaused, setHoverPaused] = useState(false);
  const carouselPaused = userPaused || hoverPaused;

  const isCategory = Boolean(categoryGroup);

  // One timer per slide shown. While a due slide waits for its photo there is
  // nothing to count down; showing it starts the next interval.
  const isWaiting = carousel.queued !== null;
  useEffect(() => {
    if (isCategory || reduceMotion || carouselPaused || isWaiting) {
      return undefined;
    }
    const timer = window.setTimeout(
      () => dispatch({ type: "advance" }),
      HERO_SLIDE_INTERVAL_MS,
    );
    return () => window.clearTimeout(timer);
  }, [activeSlide, carouselPaused, isCategory, isWaiting, reduceMotion]);

  // Holding the carousel also drops a slide that was waiting to rotate in.
  const pauseWith = (setPaused: (paused: boolean) => void) => {
    setPaused(true);
    dispatch({ type: "cancelQueue" });
  };

  if (categoryGroup) {
    const heroImg = categoryGroup.heroImage ?? categoryGroup.image;
    const heroSources = getHeroImageSources(heroImg);
    const displayLabel = subcategory ? subcategory.label : categoryGroup.label;
    const displayH1 = subcategory ? `قیمت روز ${subcategory.label}` : categoryGroup.h1;
    const displayIntro = subcategory
      ? `استعلام قیمت روز ${subcategory.label} از کارخانه‌های معتبر کشور. برای دریافت پیش‌فاکتور، استعلام موجودی و مشاوره تخصصی خرید ${subcategory.label} با واحد فروش بنیان فولاد داریا تماس بگیرید.`
      : categoryGroup.intro;

    const breadcrumbItems = pageBreadcrumb({
      kind: "catalog",
      category: categoryGroup.id,
      subcategory: subcategory?.id,
      subcategoryLabel: subcategory?.label,
    });

    return (
      <div className="hero-frame hero-frame-category">
        <section
          className="hero hero-category"
          aria-label={`معرفی و قیمت روز ${displayLabel}`}
        >
          <picture className="hero-image is-active">
            <source
              type="image/avif"
              srcSet={heroSources.avifSrcSet}
              sizes={heroSources.sizes}
            />
            <source
              type="image/webp"
              srcSet={heroSources.webpSrcSet}
              sizes={heroSources.sizes}
            />
            <img
              src={heroSources.fallbackSrc}
              srcSet={heroSources.jpgSrcSet}
              sizes={heroSources.sizes}
              alt={displayLabel}
              width={heroSources.width}
              height={heroSources.height}
              decoding="async"
              loading="eager"
              fetchPriority="high"
            />
          </picture>
          <div className="hero-overlay" />
          <div className="shell hero-content">
            <Breadcrumb items={breadcrumbItems} />
            <h1>
              <span>{displayH1}</span>
            </h1>
            <p className="hero-category-intro">{displayIntro}</p>
            <div className="hero-actions">
              <button
                className="hero-price-jump"
                type="button"
                onClick={onGoToPrices}
              >
                مشاهده جدول قیمت {displayLabel}
              </button>
              <a href={QUOTE_FORM_HREF}>
                درخواست پیش‌فاکتور {displayLabel}
              </a>
            </div>
          </div>
        </section>
      </div>
    );
  }


  const slide = heroSlides[activeSlide];

  return (
    <div className="hero-frame">
      <section
        className="hero"
        aria-roledescription="carousel"
        aria-label="محصولات منتخب بنیان فولاد داریا"
        onMouseEnter={() => pauseWith(setHoverPaused)}
        onMouseLeave={() => setHoverPaused(false)}
        onFocus={() => pauseWith(setHoverPaused)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHoverPaused(false);
          }
        }}
      >
        {heroSlides.map((item, index) => {
          const heroSources = getHeroImageSources(item.heroImage ?? item.image);
          const isCurrentActive = index === activeSlide;
          const isFirstSlide = index === 0;
          const hasPhoto =
            isFirstSlide || pageLoaded || carousel.requested[index];
          return (
            <picture
              key={item.id}
              className={`hero-image${isCurrentActive ? " is-active" : ""}`}
            >
              {hasPhoto ? (
                <>
                  <source
                    type="image/avif"
                    srcSet={heroSources.avifSrcSet}
                    sizes={heroSources.sizes}
                  />
                  <source
                    type="image/webp"
                    srcSet={heroSources.webpSrcSet}
                    sizes={heroSources.sizes}
                  />
                  <SlidePhoto
                    index={index}
                    dispatch={dispatch}
                    isLcpImage={isFirstSlide}
                    src={heroSources.fallbackSrc}
                    srcSet={heroSources.jpgSrcSet}
                    sizes={heroSources.sizes}
                    alt={item.label}
                    width={heroSources.width}
                    height={heroSources.height}
                  />
                </>
              ) : null}
            </picture>
          );
        })}
        <div className="hero-overlay" />
        <div className="shell hero-content">
          {/*
            The spans are `display: block`, so this space collapses visually --
            but without it the two lines concatenate into
            "...فولاد؛بنیان..." for anything reading textContent.
          */}
          <h1>
            <span>قیمت روز آهن و فولاد؛</span>{" "}
            <span>بنیان فولاد داریا</span>
          </h1>
          <p className="hero-lede">
            بنیان فولاد داریا؛ دسترسی سریع به قیمت، مشخصات و مسیر استعلام{" "}
            {slide.label} و دیگر مقاطع فولادی.
          </p>
          <div className="hero-actions">
            <button
              className="hero-price-jump"
              type="button"
              onClick={onGoToPrices}
            >
              ورود به مرکز قیمت فولاد
            </button>
            <a href={QUOTE_FORM_HREF}>درخواست پیش‌فاکتور</a>
          </div>
        </div>

        <div className="shell hero-live-dock" role="note" aria-label="وضعیت مرکز قیمت">
          <div>
            <span className="hero-live-dot" aria-hidden="true" />
            <strong>قیمت‌های جاری فولاد</strong>
          </div>
          <p>تفکیک محصول، کارخانه و مشخصات فنی</p>
          <p>منبع و زمان دریافت کنار جدول‌ها</p>
        </div>

        <div className="shell carousel-controls">
          <button
            type="button"
            aria-label="اسلاید قبلی"
            onClick={() =>
              dispatch({
                type: "show",
                index: (activeSlide - 1 + heroSlides.length) % heroSlides.length,
              })
            }
          >
            <ArrowIcon className="carousel-arrow is-previous" />
          </button>
          <div className="carousel-dots" role="group" aria-label="انتخاب اسلاید">
            {heroSlides.map((item, index) => (
              <button
                type="button"
                key={item.id}
                className={index === activeSlide ? "is-active" : ""}
                aria-label={`اسلاید ${(index + 1).toLocaleString("fa-IR")}: ${item.label}`}
                aria-current={index === activeSlide ? "true" : undefined}
                onClick={() => dispatch({ type: "show", index })}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="اسلاید بعدی"
            onClick={() =>
              dispatch({
                type: "show",
                index: (activeSlide + 1) % heroSlides.length,
              })
            }
          >
            <ArrowIcon className="carousel-arrow is-next" />
          </button>
          {!reduceMotion ? (
            <button
              className="carousel-pause"
              type="button"
              aria-label={
                userPaused ? "ادامه پخش اسلایدها" : "توقف اسلایدها"
              }
              aria-pressed={userPaused}
              onClick={() => {
                if (userPaused) setUserPaused(false);
                else pauseWith(setUserPaused);
              }}
            >
              {userPaused ? "پخش" : "توقف"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/**
 * A slide photo that reports once it has loaded and decoded. `decode()`
 * settles only then, so a slide never fades in half-painted. The first slide
 * is the LCP image and keeps its prerendered high-priority load; the others
 * are only rendered after the page load, when an ordinary fetch is right.
 */
function SlidePhoto({
  index,
  dispatch,
  isLcpImage,
  ...image
}: {
  index: number;
  dispatch: Dispatch<CarouselAction>;
  isLcpImage: boolean;
  src: string;
  srcSet: string;
  sizes: string;
  alt: string;
  width: number;
  height: number;
}) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const img = ref.current;
    if (!img) return undefined;
    let current = true;
    void whenPhotoSettles(img).then((status) => {
      if (current) dispatch({ type: "settled", index, status });
    });
    return () => {
      current = false;
    };
  }, [dispatch, index]);

  return (
    <img
      ref={ref}
      {...image}
      decoding="async"
      loading="eager"
      fetchPriority={isLcpImage ? "high" : undefined}
    />
  );
}
