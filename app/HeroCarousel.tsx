import { useEffect, useState } from "react";
import { productGroups, type ProductGroup } from "./category-meta";
import { Breadcrumb } from "./Breadcrumb";
import { getHeroImageSources } from "./image-utils";
import { ArrowIcon } from "./icons";

const heroSlides = productGroups.slice(0, 3);
const HERO_SLIDE_INTERVAL_MS = 9_000;

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
  const [activeSlide, setActiveSlide] = useState(0);
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

  useEffect(() => {
    if (isCategory || reduceMotion || carouselPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [carouselPaused, isCategory, reduceMotion]);

  if (categoryGroup) {
    const heroImg = categoryGroup.heroImage ?? categoryGroup.image;
    const heroSources = getHeroImageSources(heroImg);
    const displayLabel = subcategory ? subcategory.label : categoryGroup.label;
    const displayH1 = subcategory ? `قیمت روز ${subcategory.label}` : categoryGroup.h1;
    const displayIntro = subcategory
      ? `استعلام قیمت روز ${subcategory.label} از کارخانه‌های معتبر کشور. برای دریافت پیش‌فاکتور، استعلام موجودی و مشاوره تخصصی خرید ${subcategory.label} با واحد فروش بنیان فولاد داریا تماس بگیرید.`
      : categoryGroup.intro;

    const breadcrumbItems = subcategory
      ? [
          { label: "صفحه اصلی", href: "/" },
          { label: categoryGroup.label, href: `/${categoryGroup.id}/` },
          { label: subcategory.label },
        ]
      : [
          { label: "صفحه اصلی", href: "/" },
          { label: categoryGroup.label },
        ];

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
              <a href="/quote-process/#quote-form">
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
        onMouseEnter={() => setHoverPaused(true)}
        onMouseLeave={() => setHoverPaused(false)}
        onFocus={() => setHoverPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setHoverPaused(false);
          }
        }}
      >
        {heroSlides.map((item, index) => {
          const heroSources = getHeroImageSources(item.heroImage ?? item.image);
          const isCurrentActive = index === activeSlide;
          const isInitialEager = index === 0;
          return (
            <picture
              key={item.id}
              className={`hero-image${isCurrentActive ? " is-active" : ""}`}
            >
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
                alt={item.label}
                width={heroSources.width}
                height={heroSources.height}
                decoding="async"
                loading={isInitialEager ? "eager" : "lazy"}
                fetchPriority={isInitialEager ? "high" : "low"}
              />
            </picture>
          );
        })}
        <div className="hero-overlay" />
        <div className="shell hero-content">
          <h1>
            <span>قیمت روز آهن و فولاد؛</span>
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
            <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
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
              setActiveSlide(
                (current) =>
                  (current - 1 + heroSlides.length) % heroSlides.length,
              )
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
                onClick={() => setActiveSlide(index)}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="اسلاید بعدی"
            onClick={() =>
              setActiveSlide((current) => (current + 1) % heroSlides.length)
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
              onClick={() => setUserPaused((paused) => !paused)}
            >
              {userPaused ? "پخش" : "توقف"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
