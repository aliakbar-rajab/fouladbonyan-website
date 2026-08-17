import { useEffect, useState } from "react";
import { productGroups } from "./category-meta";

const heroSlides = productGroups.slice(0, 3);
const HERO_SLIDE_INTERVAL_MS = 1_700;

type HeroCarouselProps = {
  reduceMotion: boolean;
  onGoToPrices: () => void;
};

export function HeroCarousel({
  reduceMotion,
  onGoToPrices,
}: HeroCarouselProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const [carouselPaused, setCarouselPaused] = useState(false);

  useEffect(() => {
    if (reduceMotion || carouselPaused) return undefined;
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, HERO_SLIDE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [carouselPaused, reduceMotion]);

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
        {heroSlides.map((item, index) => (
          <img
            className={`hero-image${
              index === activeSlide ? " is-active" : ""
            }`}
            src={item.heroImage ?? item.image}
            alt={item.label}
            width="1672"
            height="941"
            decoding="async"
            fetchPriority={index === 0 ? "high" : "low"}
            key={item.id}
          />
        ))}
        <div className="hero-overlay" />
        <div className="shell hero-content">
          <p className="hero-kicker">تأمین و استعلام مقاطع فولادی</p>
          <h1>
            <span>بنیان فولاد داریا؛</span>
            <span>همراه مطمئن استعلام آهن و فولاد</span>
          </h1>
          <p>{slide.description}</p>
          <div className="hero-actions">
            <a href="/quote-process/#quote-form">
              درخواست پیش‌فاکتور {slide.label}
            </a>
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
          <div className="carousel-dots" aria-label="انتخاب اسلاید">
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
