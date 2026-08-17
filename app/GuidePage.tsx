import { InnerPageLayout } from "./InnerPageLayout";
import { siteConfig } from "./site-config";
import { toPersianDigits } from "./catalog-utils";
import {
  GUIDE_BASE_PATH,
  guideIndex,
  guidePageDefinitions,
  guidePageKeys,
  guidePageUrl,
  type GuidePageKey,
} from "./guide-page-data";
import type { CatalogProfile, GuideReference } from "./steel-reference";

/*
 * Editorial reference pages. Every number rendered here comes from the
 * `reference` payload, which the build derives from the same price snapshots
 * and the same weight formula the catalog uses (see steel-reference.ts). No
 * standard, tolerance or weight is written into this file by hand.
 */

const fa = (value: number, maximumFractionDigits = 0) =>
  value.toLocaleString("fa-IR", { maximumFractionDigits });

/** Fixed precision, so a numeric column stays aligned down its whole length. */
const faFixed = (value: number, digits: number) =>
  value.toLocaleString("fa-IR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const list = (values: string[]) => toPersianDigits(values.join("، "));

const sizeRange = (sizes: string[]) =>
  sizes.length > 1
    ? `${toPersianDigits(sizes[0])} تا ${toPersianDigits(sizes[sizes.length - 1])}`
    : toPersianDigits(sizes[0] ?? "—");

const findProfile = (
  reference: GuideReference,
  groupId: string,
  id: string,
): CatalogProfile | undefined =>
  reference.profiles.find(
    (profile) => profile.groupId === groupId && profile.id === id,
  );

function ComparisonTable({
  caption,
  columns,
  rows,
}: {
  caption: string;
  columns: string[];
  rows: { label: string; values: string[] }[];
}) {
  return (
    <div className="guide-table-wrap">
      <table className="guide-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">ویژگی</th>
            {columns.map((column) => (
              <th scope="col" key={column}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {row.values.map((value, index) => (
                <td key={`${row.label}-${columns[index]}`}>{value}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QuoteChecklist() {
  return (
    <section className="content-card">
      <h2>هنگام استعلام چه چیزی را اعلام کنید</h2>
      <p>
        هر ردیف در جدول‌های قیمت این سایت با همین چند مشخصه از ردیف‌های دیگر جدا
        می‌شود؛ تا این‌ها مشخص نباشد، عدد قابل اعلام نیست:
      </p>
      <ul className="checked-list">
        <li>گروه کالا و زیرگروه دقیق (مثلاً میلگرد آجدار، نه فقط «میلگرد»)</li>
        <li>سایز یا ابعاد و ضخامت مقطع</li>
        <li>استاندارد یا گرید موردنیاز، برگرفته از نقشه یا محاسبات سازه</li>
        <li>کارخانه یا برند موردنظر، اگر برایتان تفاوت دارد</li>
        <li>مقدار و واحد سفارش (کیلوگرم، تن، شاخه، برگ و...)</li>
        <li>محل تحویل و اینکه بار روی کارخانه تحویل شود یا انبار</li>
        <li>نیاز یا عدم نیاز به فاکتور رسمی و احتساب مالیات بر ارزش افزوده</li>
      </ul>
      <div className="inline-actions">
        <a href="/quote-process/#quote-form">آماده‌سازی متن درخواست</a>
        <a href={siteConfig.contact.phones[0].href}>تماس با واحد فروش</a>
      </div>
    </section>
  );
}

function RebarWeightGuide({ reference }: { reference: GuideReference }) {
  return (
    <>
      <section className="content-card">
        <h2>فرمول وزن میلگرد</h2>
        <strong className="guide-formula" dir="rtl">
          وزن هر متر (کیلوگرم) = مجذور قطر (میلی‌متر) ÷ ۱۶۲
        </strong>
        <p>
          این همان فرمولی است که ماشین‌حساب وزن در جدول قیمت میلگرد همین سایت از
          آن استفاده می‌کند. برای یک شاخه، حاصل را در طول شاخه (بر حسب متر) ضرب
          کنید. مثلاً میلگرد قطر ۱۶: <b>{toPersianDigits("16²")} ÷ ۱۶۲</b> برابر
          است با {faFixed(16 ** 2 / 162, 3)} کیلوگرم در هر متر، و یک شاخه ۱۲
          متری حدود {faFixed((16 ** 2 / 162) * 12, 2)} کیلوگرم می‌شود.
        </p>
        <p>
          فرمول برای میلگرد فولادی کربنی نوشته شده است. برای میلگرد استیل و
          آلیاژی چگالی متفاوت است و در این صفحه جدول وزنی برای آن‌ها منتشر
          نکرده‌ایم؛ وزن این دو گروه را از واحد فروش بگیرید.
        </p>
      </section>

      {reference.rebarTables.map((table) => (
        <section className="content-card" key={table.id}>
          <h2>{`جدول وزن ${table.label}`}</h2>
          <p>
            {[
              table.standards.length
                ? `استانداردهای موجود در جدول قیمت: ${list(table.standards)}. عرضه توسط ${fa(table.factoryCount)} کارخانه.`
                : "",
              table.branchLengthM === null
                ? "کاتالوگ برای این گروه طول شاخه اعلام نکرده است، بنابراین فقط وزن هر متر آورده شده است."
                : `طول شاخه اعلامی در کاتالوگ ${toPersianDigits(String(table.branchLengthM))} متر است.`,
            ]
              .filter(Boolean)
              .join(" ")}
          </p>
          <div className="guide-table-wrap">
            <table className="guide-table">
              <caption>
                {`وزن ${table.label} بر پایه فرمول استاندارد وزن — ${fa(table.rows.length)} سایز`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">قطر (میلی‌متر)</th>
                  <th scope="col">وزن هر متر (کیلوگرم)</th>
                  {table.branchLengthM === null ? null : (
                    <>
                      <th scope="col">
                        {`وزن شاخه ${toPersianDigits(String(table.branchLengthM))} متری (کیلوگرم)`}
                      </th>
                      <th scope="col">تعداد شاخه در هر تن</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.size}>
                    <th scope="row">{toPersianDigits(row.size)}</th>
                    <td>{faFixed(row.kgPerMeter, 3)}</td>
                    {table.branchLengthM === null ? null : (
                      <>
                        <td>
                          <b>{faFixed(row.kgPerBranch ?? 0, 2)}</b>
                        </td>
                        <td>{fa(row.branchesPerTon ?? 0)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="inline-actions">
            <a href={table.href}>{`قیمت روز ${table.label}`}</a>
          </div>
        </section>
      ))}

      <section className="content-card legal-copy">
        <h2>وزن محاسباتی در برابر وزن باسکول</h2>
        <p>
          اعداد بالا وزن اسمی‌اند: نتیجه یک فرمول، نه اندازه‌گیری یک شاخه واقعی.
          میلگرد در جدول‌های این سایت بر حسب کیلوگرم قیمت می‌خورد، پس آنچه در
          فاکتور ضرب می‌شود وزن باسکول همان بار است، نه وزن جدول. جدول قیمت
          میلگرد برای هر ردیف «وزن تقریبی» اعلامی خودش را هم نشان می‌دهد و این
          عدد بین کارخانه‌ها یکسان نیست.
        </p>
        <p>
          از این جدول برای برآورد اولیه، تبدیل شاخه به تن و کنترل بار تحویلی
          استفاده کنید؛ برای تسویه، وزن باسکول ملاک است.
        </p>
        <div className="inline-actions">
          <a href="/rebar/">قیمت روز میلگرد</a>
          <a href={guidePageUrl("ribbed-vs-plain-rebar")}>
            تفاوت میلگرد آجدار و ساده
          </a>
          <a href={guidePageUrl("units-and-quote-specs")}>واحدهای فروش</a>
        </div>
      </section>
    </>
  );
}

function BeamWeightGuide({ reference }: { reference: GuideReference }) {
  const { beamTable } = reference;
  const widest = beamTable.rows
    .filter((row) => row.entries.length > 1 && row.minKg > 0)
    .map((row) => ({ row, spread: row.maxKg - row.minKg }))
    .sort((a, b) => b.spread - a.spread)[0];

  return (
    <>
      <section className="content-card">
        <h2>این وزن‌ها محاسبه نشده‌اند</h2>
        <p>
          برخلاف میلگرد، وزن تیرآهن را با یک فرمول ساده نمی‌شود درآورد. اعداد این
          جدول همان وزن تقریبی‌اند که هر کارخانه برای شاخه خودش اعلام می‌کند و
          در جدول قیمت تیرآهن این سایت هم کنار همان ردیف دیده می‌شوند. ردیف‌هایی
          که کارخانه برایشان وزنی اعلام نکرده، اینجا نیامده‌اند.
        </p>
        {widest ? (
          <p>
            به همین دلیل وزن یک سایز مشخص بین کارخانه‌ها یکسان نیست. مثلاً شاخه{" "}
            {toPersianDigits(String(widest.row.branchLengthM))} متری تیرآهن{" "}
            {toPersianDigits(widest.row.size)} در این جدول از{" "}
            {fa(widest.row.minKg)} تا {fa(widest.row.maxKg)} کیلوگرم اعلام شده
            است — {fa(widest.spread)} کیلوگرم اختلاف، یعنی حدود{" "}
            {fa((widest.spread / widest.row.minKg) * 100)}٪ روی وزن هر شاخه.
          </p>
        ) : null}
      </section>

      <section className="content-card">
        <h2>{`وزن شاخه تیرآهن ${toPersianDigits("IPE")} به تفکیک کارخانه`}</h2>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <caption>
              وزن اعلامی کارخانه برای هر شاخه — {fa(beamTable.rows.length)} ردیف
              سایز، برداشت‌شده از داده {reference.sourceDateLabel}
            </caption>
            <thead>
              <tr>
                <th scope="col">استاندارد</th>
                <th scope="col">سایز</th>
                <th scope="col">طول شاخه (متر)</th>
                <th scope="col">وزن اعلامی هر کارخانه (کیلوگرم)</th>
                <th scope="col">بازه</th>
              </tr>
            </thead>
            <tbody>
              {beamTable.rows.map((row) => (
                <tr key={`${row.standard}-${row.size}-${row.branchLengthM}`}>
                  <th scope="row">{toPersianDigits(row.standard)}</th>
                  <td>{toPersianDigits(row.size)}</td>
                  <td>{toPersianDigits(String(row.branchLengthM))}</td>
                  <td>
                    <ul className="guide-mill-list">
                      {row.entries.map((entry) => (
                        <li key={entry.factory}>
                          {entry.factory} {fa(entry.weightKg)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <b>
                      {row.minKg === row.maxKg
                        ? fa(row.minKg)
                        : `${fa(row.minKg)} تا ${fa(row.maxKg)}`}
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="guide-note">
          وزن اعلامی کارخانه یک عدد اسمی است. وزن واقعی هر بار در باسکول تعیین
          می‌شود و ملاک فاکتور همان است.
        </p>
      </section>

      <section className="content-card">
        <h2>چرا وزن شاخه در خرید تیرآهن مهم است</h2>
        <p>
          تیرآهن در جدول قیمت این سایت هم به «شاخه» و هم به «کیلوگرم» قیمت
          می‌خورد. مقایسه دو پیشنهاد که یکی شاخه‌ای و دیگری کیلویی اعلام شده،
          بدون دانستن وزن شاخه ممکن نیست؛ و چون همان سایز از دو کارخانه دو وزن
          متفاوت دارد، تبدیل را باید با وزن همان کارخانه انجام داد.
        </p>
        <div className="inline-actions">
          <a href={beamTable.href}>{`قیمت روز ${beamTable.label}`}</a>
          <a href={guidePageUrl("ipe-vs-hash-beam")}>
            انواع تیرآهن {toPersianDigits("IPE")} و هاش
          </a>
          <a href={guidePageUrl("units-and-quote-specs")}>واحدهای فروش</a>
        </div>
      </section>

      {beamTable.missingWeightLabels.length ? (
        <section className="content-card legal-copy">
          <h2>چرا جدول وزن هاش اینجا نیست</h2>
          <p>
            برای {list(beamTable.missingWeightLabels)} هیچ وزن اعلامی در داده
            قیمت وجود ندارد. به‌جای پرکردن جدول با عددی که نمی‌توانیم به آن
            استناد کنیم، این بخش را منتشر نکرده‌ایم؛ وزن شاخه هاش را پیش از
            سفارش از واحد فروش بگیرید.
          </p>
          <div className="inline-actions">
            <a href="/beam/hash/">قیمت روز تیرآهن هاش</a>
            <a href={siteConfig.contact.phones[0].href}>تماس با واحد فروش</a>
          </div>
        </section>
      ) : null}
    </>
  );
}

function profileRow(label: string, profiles: (CatalogProfile | undefined)[], read: (profile: CatalogProfile) => string) {
  return {
    label,
    values: profiles.map((profile) => (profile ? read(profile) : "—")),
  };
}

function RibbedVsPlainGuide({ reference }: { reference: GuideReference }) {
  const ribbed = findProfile(reference, "rebar", "ribbed");
  const simple = findProfile(reference, "rebar", "simple");
  const profiles = [ribbed, simple];
  const columns = [ribbed?.label ?? "میلگرد آجدار", simple?.label ?? "میلگرد ساده"];

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
          caption={`برداشت‌شده از داده قیمت ${reference.sourceDateLabel}`}
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
          {ribbed ? <a href={ribbed.href}>{`قیمت روز ${ribbed.label}`}</a> : null}
          {simple ? <a href={simple.href}>{`قیمت روز ${simple.label}`}</a> : null}
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

function BeamTypesGuide({ reference }: { reference: GuideReference }) {
  const beam = findProfile(reference, "beam", "beam");
  const hash = findProfile(reference, "beam", "hash");
  const profiles = [beam, hash];
  const columns = [beam?.label ?? "تیرآهن", hash?.label ?? "تیرآهن هاش"];

  return (
    <>
      <section className="content-card">
        <h2>{`${toPersianDigits("IPE")}، ${toPersianDigits("HEA")} و ${toPersianDigits("HEB")}`}</h2>
        <p>
          تیرآهن معمولی با استاندارد {toPersianDigits("IPE")} بال باریک دارد و
          پرکاربردترین مقطع تیر در ساختمان‌سازی است. هاش مقطع بال‌پهن است و در
          کاتالوگ در دو رده عرضه می‌شود: هاش سبک با استاندارد{" "}
          {toPersianDigits("HEA")} و هاش سنگین با استاندارد{" "}
          {toPersianDigits("HEB")}.
        </p>
        <p>
          انتخاب بین این سه از محاسبات سازه می‌آید، نه از قیمت. آنچه این صفحه
          می‌گوید این است که بازار امروز کدام‌یک را و در چه سایزی عرضه می‌کند.
        </p>
      </section>

      <section className="content-card">
        <h2>آنچه امروز در کاتالوگ موجود است</h2>
        <ComparisonTable
          caption={`برداشت‌شده از داده قیمت ${reference.sourceDateLabel}`}
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
          وزن شاخه تیرآهن {toPersianDigits("IPE")} برای یک سایز مشخص بین
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

function UnitsGuide({ reference }: { reference: GuideReference }) {
  return (
    <>
      <section className="content-card">
        <h2>واحدهایی که مقاطع فولادی با آن قیمت می‌خورند</h2>
        <p>
          «قیمت چند است؟» تا وقتی واحد مشخص نباشد جواب ندارد. جدول زیر واحدهای
          واقعی به‌کاررفته در جدول‌های قیمت این سایت را نشان می‌دهد، به‌همراه
          تعداد ردیفی که با هر واحد قیمت خورده‌اند.
        </p>
        <div className="guide-table-wrap">
          <table className="guide-table">
            <caption>
              برداشت‌شده از داده قیمت {reference.sourceDateLabel}
            </caption>
            <thead>
              <tr>
                <th scope="col">واحد</th>
                <th scope="col">تعداد ردیف قیمت</th>
                <th scope="col">بیشتر در کدام گروه‌ها</th>
              </tr>
            </thead>
            <tbody>
              {reference.unitUsage.map((usage) => (
                <tr key={usage.unit}>
                  <th scope="row">{usage.unit}</th>
                  <td>{fa(usage.rowCount)}</td>
                  <td>
                    <ul className="guide-mill-list">
                      {usage.examples.map((example) => (
                        <li key={example.href}>
                          <a href={example.href}>{example.label}</a>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="content-card">
        <h2>کیلوگرم در برابر شاخه</h2>
        <p>
          <b>کیلوگرم</b> پرکاربردترین واحد است: مبلغ از ضرب وزن در قیمت هر کیلو
          درمی‌آید و وزن باسکول بار، نه وزن جدول، ملاک فاکتور است. سفارش «تن» هم
          همین است با ضریب هزار.
        </p>
        <p>
          <b>شاخه</b> یعنی قیمت برای یک شاخه کامل اعلام شده است. مقایسه یک
          پیشنهاد شاخه‌ای با یک پیشنهاد کیلویی فقط وقتی درست است که وزن همان شاخه
          از همان کارخانه را داشته باشید — و آن وزن بین کارخانه‌ها یکسان نیست.
        </p>
        <p>
          <b>برگ، طاقه و مترمربع</b> در محصولات مفتولی و توری به کار می‌روند؛
          آنجا ابعاد ورق یا رول بخشی از تعریف کالاست و بدون آن عدد قابل مقایسه
          نیست.
        </p>
        <div className="inline-actions">
          <a href={guidePageUrl("rebar-weight-chart")}>جدول وزن میلگرد</a>
          <a href={guidePageUrl("beam-weight-chart")}>جدول وزن تیرآهن</a>
          <a href="/#prices">قیمت‌های اطلاع‌رسانی</a>
        </div>
      </section>

      <QuoteChecklist />

      <section className="content-card legal-copy">
        <h2>قیمت سایت، قیمت قطعی نیست</h2>
        <p>
          اعدادی که در جدول‌ها می‌بینید برای شناخت حدود بازار است. قیمت قطعی،
          موجودی و زمان تحویل فقط پس از بررسی واحد فروش و در پیش‌فاکتور دارای
          مدت اعتبار قابل استناد است.
        </p>
        <div className="inline-actions">
          <a href="/quote-process/">فرایند درخواست پیش‌فاکتور</a>
          <a href="/terms/">شرایط استفاده</a>
        </div>
      </section>
    </>
  );
}

function GuideIndexContent() {
  return (
    <>
      <section className="content-card">
        <h2>صفحه‌های مرجع</h2>
        <p>
          این بخش برای پاسخ به پرسش‌هایی است که جدول قیمت جواب نمی‌دهد: یک شاخه
          چقدر وزن دارد، دو محصول هم‌نام چه فرقی دارند، و برای گرفتن قیمت چه
          چیزی باید مشخص باشد.
        </p>
        <ul className="guide-card-list">
          {guidePageKeys.map((key) => {
            const definition = guidePageDefinitions[key];
            return (
              <li key={key}>
                <a href={guidePageUrl(key)}>
                  <em>{definition.eyebrow}</em>
                  <strong>{definition.title}</strong>
                  <span>{definition.description}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="content-card legal-copy">
        <h2>این صفحه‌ها از کجا می‌آیند</h2>
        <p>
          جدول‌های وزن و مقایسه‌ها از همان داده قیمتی ساخته می‌شوند که جدول‌های
          این سایت را پر می‌کند، و وزن میلگرد با همان فرمولی محاسبه می‌شود که
          ماشین‌حساب وزن صفحه میلگرد از آن استفاده می‌کند. هر جا داده‌ای در دست
          نبوده — مثلاً وزن اعلامی شاخه هاش — چیزی جای آن ننوشته‌ایم.
        </p>
        <div className="inline-actions">
          <a href="/#prices">قیمت روز آهن و فولاد</a>
          <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
        </div>
      </section>
    </>
  );
}

function GuideContent({
  guide,
  reference,
}: {
  guide: GuidePageKey;
  reference: GuideReference;
}) {
  if (guide === "rebar-weight-chart")
    return <RebarWeightGuide reference={reference} />;
  if (guide === "beam-weight-chart")
    return <BeamWeightGuide reference={reference} />;
  if (guide === "ribbed-vs-plain-rebar")
    return <RibbedVsPlainGuide reference={reference} />;
  if (guide === "ipe-vs-hash-beam")
    return <BeamTypesGuide reference={reference} />;
  return <UnitsGuide reference={reference} />;
}

export type GuidePageProps = {
  /** Undefined renders the /guide/ index. */
  guide?: GuidePageKey;
  reference: GuideReference;
};

export default function GuidePage({ guide, reference }: GuidePageProps) {
  const definition = guide ? guidePageDefinitions[guide] : guideIndex;

  return (
    <InnerPageLayout
      // Must match the <title> the build stamps into the head, or the tab
      // title changes the moment hydration runs.
      documentTitle={definition.seoTitle}
      eyebrow={definition.eyebrow}
      title={definition.title}
      description={definition.description}
      contentClassName="guide-content"
      breadcrumbItems={
        guide
          ? [
              { label: "صفحه اصلی", href: "/" },
              { label: guideIndex.title, href: GUIDE_BASE_PATH },
              { label: definition.title },
            ]
          : [
              { label: "صفحه اصلی", href: "/" },
              { label: guideIndex.title },
            ]
      }
    >
      {guide ? (
        <GuideContent guide={guide} reference={reference} />
      ) : (
        <GuideIndexContent />
      )}
    </InnerPageLayout>
  );
}
