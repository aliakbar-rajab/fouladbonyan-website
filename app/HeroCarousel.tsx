import { useEffect, useState } from "react";
import { productGroups, type ProductGroup } from "./category-meta";
import { Breadcrumb } from "./Breadcrumb";
import { getHeroImageSources } from "./image-utils";

const heroSlides = productGroups.slice(0, 3);
const HERO_SLIDE_INTERVAL_MS = 1_700;

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
  const [carouselPaused, setCarouselPaused] = useState(false);

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
            <p className="hero-kicker">
              تأمین و استعلام مقاطع فولادی — بنیان فولاد داریا
            </p>
            <h1>
              <span>{displayH1}</span>
            </h1>
            <p className="hero-category-intro">{displayIntro}</p>
            <div className="hero-actions">
              <a href="/quote-process/#quote-form">
                درخواست پیش‌فاکتور {displayLabel}
              </a>
              <button
                className="hero-price-jump"
                type="button"
                onClick={onGoToPrices}
              >
                مشاهده جدول قیمت {displayLabel}
              </button>
              {subcategory ? (
                <a href={`/${categoryGroup.id}/`}>
                  سایر انواع {categoryGroup.label}
                </a>
              ) : (
                <a href="#products">سایر گروه‌های محصول</a>
              )}
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
        onMouseEnter={() => setCarouselPaused(true)}
        onMouseLeave={() => setCarouselPaused(false)}
        onFocus={() => setCarouselPaused(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setCarouselPaused(false);
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
          <p className="hero-kicker">تأمین و استعلام مقاطع فولادی</p>
          <h1>
            <span>قیمت روز آهن و فولاد؛</span>
            <span>بنیان فولاد داریا</span>
          </h1>
          <p>{slide.description}</p>
          <div className="hero-actions">
            <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
            <button
              className="hero-price-jump"
              type="button"
              onClick={onGoToPrices}
            >
              قیمت روز مقاطع فولادی
            </button>
            <a href="#products">مشاهده محصولات</a>
          </div>
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
            →
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
            ←
          </button>
          {!reduceMotion ? (
            <button
              className="carousel-pause"
              type="button"
              aria-label={
                carouselPaused ? "ادامه پخش اسلایدها" : "توقف اسلایدها"
              }
              aria-pressed={carouselPaused}
              onClick={() => setCarouselPaused((paused) => !paused)}
            >
              {carouselPaused ? "پخش" : "توقف"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
