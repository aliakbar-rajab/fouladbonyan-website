import { productGroups, type ProductGroupId } from "./category-meta";
import { getCategoryImageSources } from "./image-utils";

interface CategoryGridProps {
  onSelectGroup: (groupId: ProductGroupId) => void;
  activeGroup: ProductGroupId;
}

export function CategoryGrid({ onSelectGroup, activeGroup }: CategoryGridProps) {
  return (
    <div className="price-family-navigator" id="products">
      <div className="price-family-heading">
        <h3>انتخاب خانواده محصول</h3>
        <p>برای ورود به جدول تخصصی، یک گروه فولادی را انتخاب کنید.</p>
      </div>
      <div className="category-grid">
        {productGroups.map((group) => {
          const sources = getCategoryImageSources(group.image);
          return (
            <a
              className={`category-card${group.id === activeGroup ? " is-active" : ""}`}
              href={`/${group.id}/`}
              key={group.id}
              aria-current={group.id === activeGroup ? "true" : undefined}
              onClick={(event) => {
                event.preventDefault();
                onSelectGroup(group.id);
              }}
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
              <b aria-hidden="true">←</b>
            </a>
          );
        })}
      </div>
    </div>
  );
}
