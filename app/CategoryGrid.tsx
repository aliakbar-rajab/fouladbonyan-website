import { productGroups } from "./category-meta";
import { getCategoryImageSources } from "./image-utils";

export function CategoryGrid() {
  return (
    <div className="price-family-navigator" id="products">
      <div className="price-family-heading">
        <h3>راهنمای خانواده‌های فولادی</h3>
        <p>پس از مرور قیمت‌ها، مشخصات و کاربرد هر خانواده را بررسی کنید.</p>
      </div>
      <div className="category-grid">
        {productGroups.map((group) => {
          const sources = getCategoryImageSources(group.image);
          return (
            <a
              className="category-card"
              href={`/${group.id}/`}
              key={group.id}
            >
              <picture>
                <source
                  type="image/avif"
                  srcSet={sources.avifSrcSet}
                  sizes={sources.sizes}
                />
                <source
                  type="image/webp"
                  srcSet={sources.webpSrcSet}
                  sizes={sources.sizes}
                />
                <img
                  src={sources.fallbackSrc}
                  srcSet={sources.jpgSrcSet}
                  sizes={sources.sizes}
                  alt={group.imageAlt}
                  width={sources.width}
                  height={sources.height}
                  loading="lazy"
                  decoding="async"
                />
              </picture>
              <span>
                <strong>{group.label}</strong>
                <small>{group.description}</small>
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
