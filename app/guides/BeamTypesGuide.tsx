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

export function BeamTypesGuide({ reference }: { reference: GuideReference }) {
  const beam = findProfile(reference, "beam", "beam");
  const hash = findProfile(reference, "beam", "hash");
  const profiles = [beam, hash];
  const columns = [beam?.label ?? "تیرآهن", hash?.label ?? "تیرآهن هاش"];

  return (
    <>
      <section className="content-card">
        <h2>IPE، HEA و HEB</h2>
        <p>
          تیرآهن معمولی با استاندارد IPE بال باریک دارد و
          پرکاربردترین مقطع تیر در ساختمان‌سازی است. هاش مقطع بال‌پهن است و در
          کاتالوگ در دو رده عرضه می‌شود: هاش سبک با استاندارد HEA و هاش سنگین
          با استاندارد HEB.
        </p>
        <p>
          انتخاب بین این سه از محاسبات سازه می‌آید، نه از قیمت. آنچه این صفحه
          می‌گوید این است که بازار امروز کدام‌یک را و در چه سایزی عرضه می‌کند.
        </p>
      </section>

      <section className="content-card">
        <h2>آنچه امروز در کاتالوگ موجود است</h2>
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
            profileRow("استانداردها", profiles, (profile) =>
              profile.standards.length ? list(profile.standards) : "—",
            ),
            profileRow("بازه سایز", profiles, (profile) =>
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
                ? list(profile.branchLengths)
                : "در کاتالوگ اعلام نشده",
            ),
          ]}
        />
        <p className="guide-note">
          دو تفاوت عملی که مستقیم از همین جدول بیرون می‌آید: تنوع تأمین‌کننده
          {beam && hash
            ? ` (${fa(beam.factoryCount)} کارخانه در برابر ${fa(hash.factoryCount)} کارخانه)`
            : ""}
          ، و واحد فروش — تیرآهن معمولی هم شاخه‌ای و هم کیلویی قیمت می‌خورد، در
          حالی که هاش در این کاتالوگ فقط کیلویی است. هر دو نکته روی نحوه استعلام
          و مقایسه پیشنهادها اثر می‌گذارد.
        </p>
        <div className="inline-actions">
          {beam ? <a href={beam.href}>{`قیمت روز ${beam.label}`}</a> : null}
          {hash ? <a href={hash.href}>{`قیمت روز ${hash.label}`}</a> : null}
          <a href="/beam/">همه گروه تیرآهن</a>
        </div>
      </section>

      <section className="content-card">
        <h2>وزن شاخه را جدا بپرسید</h2>
        <p>
          وزن شاخه تیرآهن IPE برای یک سایز مشخص بین
          کارخانه‌ها فرق دارد و جدول کامل آن را در صفحه جدول وزن تیرآهن
          آورده‌ایم. برای هاش، داده قیمت وزن اعلامی ندارد؛ آن را پیش از سفارش از
          واحد فروش بگیرید.
        </p>
        <div className="inline-actions">
          <a href={guidePageUrl("beam-weight-chart")}>جدول وزن تیرآهن</a>
        </div>
      </section>

      <QuoteChecklist />
    </>
  );
}
