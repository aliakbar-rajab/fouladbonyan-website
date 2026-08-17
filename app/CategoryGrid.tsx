import { productGroups, type ProductGroupId } from "./category-meta";
import { SectionTitle } from "./site-ui";
import { getCategoryImageSources } from "./image-utils";

interface CategoryGridProps {
  onSelectGroup: (groupId: ProductGroupId) => void;
}

export function CategoryGrid({ onSelectGroup }: CategoryGridProps) {
  return (
    <section className="products section" id="products">
      <div className="shell">
        <SectionTitle
          eyebrow="گروه‌های محصول"
          title="محصول مورد نیاز خود را انتخاب کنید"
          description="برای دیدن مشخصات قابل تأمین و تماس با واحد فروش، یک گروه محصول را انتخاب کنید."
        />
        <div className="category-grid">
          {productGroups.map((group) => {
            const sources = getCategoryImageSources(group.image);
            return (
              <a
                className="category-card"
                href={`/${group.id}/`}
                key={group.id}
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
    </section>
  );
}
