import { guidePageUrl } from "../guide-page-data";
import type { GuideReference } from "../steel-reference";
import { ComparisonTable, QuoteChecklist } from "./GuideShared";
import {
  fa,
  findProfile,
  list,
  profileRow,
  sizeRange,
} from "./guide-helpers";

export function RibbedVsPlainGuide({
  reference,
}: {
  reference: GuideReference;
}) {
  const ribbed = findProfile(reference, "rebar", "ribbed");
  const simple = findProfile(reference, "rebar", "simple");
  const profiles = [ribbed, simple];
  const columns = [
    ribbed?.label ?? "میلگرد آجدار",
    simple?.label ?? "میلگرد ساده",
  ];

  return (
    <>
      <section className="content-card">
        <h2>آج چه فرقی می‌گذارد</h2>
        <p>
          میلگرد آجدار روی سطح خود برجستگی‌های نورد‌شده دارد؛ میلگرد ساده سطح صاف
          دارد. تفاوت در نام محصول همین است و بقیه تفاوت‌ها — استاندارد،
          سایزبندی و تعداد تولیدکننده — از دل همین دو خط تولید متفاوت درمی‌آید.
        </p>
        <p>
          انتخاب بین این دو و انتخاب استاندارد، تصمیم قیمتی نیست؛ از نقشه اجرایی
          و محاسبات سازه می‌آید. این صفحه فقط توضیح می‌دهد بازار چه چیزی عرضه
          می‌کند.
        </p>
      </section>

      <section className="content-card">
        <h2>مقایسه در جدول قیمت امروز</h2>
        <ComparisonTable
          caption={
            <>
              برداشت‌شده از داده قیمت{" "}
              <time dateTime={reference.sourceDateIso}>
                {reference.sourceDateLabel}
              </time>
            </>
          }
          columns={columns}
          rows={[
            profileRow("استانداردهای موجود", profiles, (profile) =>
              profile.standards.length ? list(profile.standards) : "—",
            ),
            profileRow("بازه سایز (میلی‌متر)", profiles, (profile) =>
              sizeRange(profile.sizes),
            ),
            profileRow("تعداد سایز", profiles, (profile) =>
              fa(profile.sizes.length),
            ),
            profileRow("تعداد کارخانه", profiles, (profile) =>
              fa(profile.factoryCount),
            ),
            profileRow("تعداد ردیف قیمت", profiles, (profile) =>
              fa(profile.rowCount),
            ),
            profileRow("واحد فروش", profiles, (profile) =>
              list(profile.units),
            ),
            profileRow("طول شاخه اعلامی", profiles, (profile) =>
              profile.branchLengths.length
                ? `${list(profile.branchLengths)} متر`
                : "در کاتالوگ اعلام نشده",
            ),
          ]}
        />
        <p className="guide-note">
          بازه سایز میلگرد ساده شامل نیم‌سایزها هم هست، در حالی که میلگرد آجدار
          فقط با سایزهای کامل عرضه می‌شود. تعداد کارخانه‌ها هم قابل‌مقایسه نیست؛
          هرچه تعداد کمتر باشد، مشخص‌کردن کارخانه در استعلام مهم‌تر می‌شود.
        </p>
        <div className="inline-actions">
          {ribbed ? (
            <a href={ribbed.href}>{`قیمت روز ${ribbed.label}`}</a>
          ) : null}
          {simple ? (
            <a href={simple.href}>{`قیمت روز ${simple.label}`}</a>
          ) : null}
          <a href="/rebar/">همه گروه میلگرد</a>
        </div>
      </section>

      <section className="content-card">
        <h2>وزن هر دو با یک فرمول درمی‌آید</h2>
        <p>
          هر دو محصول مقطع گرد دارند، پس وزن هر متر هر دو با فرمول یکسان محاسبه
          می‌شود؛ آج در وزن اسمی لحاظ نمی‌شود. جدول کامل هر دو در صفحه جدول وزن
          میلگرد آمده است.
        </p>
        <div className="inline-actions">
          <a href={guidePageUrl("rebar-weight-chart")}>جدول وزن میلگرد</a>
        </div>
      </section>

      <QuoteChecklist />
    </>
  );
}
