import { productGroups, type ProductGroupId } from "./category-meta";
import { SectionTitle } from "./site-ui";

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
          {productGroups.map((group) => (
            <a
              className="category-card"
              href={`/${group.id}/`}
              key={group.id}
              onClick={(event) => {
                event.preventDefault();
                onSelectGroup(group.id);
              }}
            >
              <img
                src={group.image}
                alt={`انواع ${group.label}`}
                width="480"
                height="320"
                loading="lazy"
                decoding="async"
              />
              <span>
                <strong>{group.label}</strong>
                <small>{group.description}</small>
              </span>
              <b aria-hidden="true">←</b>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
