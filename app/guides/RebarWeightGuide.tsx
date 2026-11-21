import { QUOTE_FORM_HREF } from "../quote-handoff";
import { toPersianDigits } from "../persian-numbers.mjs";
import { guidePageUrl, REBAR_WEIGHT_FAQS } from "../guide-page-data";
import { RebarWeightCalculator } from "../RebarWeightCalculator";
import type { GuideReference } from "../steel-reference";
import { GuideTableWrap } from "./GuideShared";
import { fa, faFixed, list } from "./guide-helpers";

const QUICK_ANSWER_SIZES = ["8", "12", "14", "16"] as const;

export function RebarWeightGuide({ reference }: { reference: GuideReference }) {
  const ribbedStandardRows = new Map(
    (reference.rebarTables.find((t) => t.id === "ribbed")?.rows ?? []).map(
      (row) => [row.size, row],
    ),
  );
  const millRowsBySize = new Map(
    reference.rebarMillTable.rows.map((row) => [row.size, row]),
  );

  return (
    <>
      <section className="content-card">
        <h2>وزن سریع میلگردهای پرکاربرد (شاخه ۱۲ متری)</h2>
        <p>
          پاسخ سریع بر اساس فرمول اشتال و بازه وزن واقعی کارخانه‌های ایران در
          کاتالوگ همین سایت:
        </p>
        <div className="quick-answer-grid">
          {QUICK_ANSWER_SIZES.map((size) => {
            const std = ribbedStandardRows.get(size);
            const mill = millRowsBySize.get(size);
            if (!std) return null;
            return (
              <article className="quick-answer-card" key={size}>
                <h3>{`میلگرد ${toPersianDigits(size)} آجدار (۱۲ متری)`}</h3>
                <strong>
                  {`${faFixed(std.kgPerBranch ?? 0, 2)} کیلوگرم`}
                </strong>
                <span>{`هر متر: ${faFixed(std.kgPerMeter, 3)} کیلوگرم`}</span>
                {mill?.minMillKg && mill?.maxMillKg ? (
                  <span>
                    {`بازه کارخانه‌ها: ${faFixed(mill.minMillKg, 1)} تا ${faFixed(mill.maxMillKg, 1)} کیلو`}
                  </span>
                ) : null}
                <span>
                  {`حدود ${fa(std.branchesPerTon ?? 0)} شاخه در هر تن`}
                </span>
              </article>
            );
          })}
        </div>
      </section>

      <div className="rebar-guide-tools">
        <section className="content-card">
          <h2>ماشین‌حساب آنلاین وزن و برآورد قیمت میلگرد</h2>
          <p>
            قطر، طول شاخه و تعداد را وارد کنید تا وزن کل و برآورد قیمت تقریبی
            بر پایه میانگین میلگرد آجدار امروز محاسبه شود.
          </p>
          <div className="guide-calculator-mount">
            <RebarWeightCalculator
              defaultOpen
              averagePricePerKg={reference.ribbedPriceBridge?.average ?? null}
              showGuideLink={false}
            />
          </div>
        </section>

        <section className="content-card rebar-bridge-card">
          <h2>قیمت روز میلگرد و ثبت سفارش</h2>
          {reference.ribbedPriceBridge ? (
            <>
              <p>
                {`قیمت روز میلگرد آجدار (${toPersianDigits(reference.ribbedPriceBridge.date)}) از ${fa(reference.ribbedPriceBridge.factoryCount)} کارخانه در بازه `}
                <b>{fa(reference.ribbedPriceBridge.min)}</b>
                {" تا "}
                <b>{fa(reference.ribbedPriceBridge.max)}</b>
                {" تومان به ازای هر کیلوگرم قرار دارد."}
              </p>
              <p>
                {`میانگین بازار امروز میلگرد آجدار: ${fa(reference.ribbedPriceBridge.average)} تومان/کیلوگرم (بدون ارزش افزوده).`}
              </p>
            </>
          ) : (
            <p>
              برای مشاهده قیمت روز تمامی کارخانه‌ها و مقایسه نرخ هر کیلوگرم، به
              جدول قیمت میلگرد مراجعه کنید.
            </p>
          )}
          <div className="inline-actions">
            <a href="/rebar/ribbed/">مشاهده قیمت روز میلگرد آجدار</a>
            <a href="/rebar/simple/">قیمت روز میلگرد ساده</a>
            <a href={QUOTE_FORM_HREF}>درخواست پیش‌فاکتور میلگرد</a>
          </div>
        </section>
      </div>

      {reference.rebarMillTable.rows.length > 0 ? (
        <section className="content-card">
          <h2>مقایسه وزن واقعی شاخه ۱۲ متری کارخانه‌های ایران در برابر جدول اشتال</h2>
          <p>
            جدول زیر وزن تقریبی یک شاخه ۱۲ متری میلگرد آجدار کارخانه‌های شاخص
            ایران را (مستخرج از داده‌های کاتالوگ سایت) در برابر وزن استاندارد
            اشتال نشان می‌دهد. برای ردیف‌هایی که کارخانه وزن اعلام نکرده، علامت
            «—» درج شده است.
          </p>
          <GuideTableWrap label="جدول مقایسه وزن میلگرد کارخانه‌های ایران و جدول اشتال">
            <table className="guide-table">
              <caption>
                {`مقایسه وزن شاخه ۱۲ متری میلگرد آجدار کارخانه‌ها (کیلوگرم) — ${fa(reference.rebarMillTable.mills.length)} کارخانه`}
              </caption>
              <thead>
                <tr>
                  <th scope="col">سایز</th>
                  <th scope="col">اشتال (کیلوگرم)</th>
                  {reference.rebarMillTable.mills.map((mill) => (
                    <th scope="col" key={mill}>
                      {mill}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reference.rebarMillTable.rows.map((row) => (
                  <tr key={row.size}>
                    <th scope="row">{`میلگرد ${toPersianDigits(row.size)}`}</th>
                    <td>
                      <b>{faFixed(row.stahlKg, 2)}</b>
                    </td>
                    {reference.rebarMillTable.mills.map((mill) => {
                      const weight = row.weightsByMill[mill];
                      return (
                        <td key={`${row.size}-${mill}`}>
                          {weight === null || weight === undefined
                            ? "—"
                            : faFixed(weight, weight % 1 === 0 ? 1 : 2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </GuideTableWrap>
          <div className="inline-actions">
            <a href="/rebar/ribbed/">مقایسه قیمت میلگرد آجدار ۲۷ کارخانه</a>
          </div>
        </section>
      ) : null}

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
          <GuideTableWrap label={`جدول وزن ${table.label}`}>
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
                    <th scope="row">{`میلگرد ${toPersianDigits(row.size)}`}</th>
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
          </GuideTableWrap>
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
      </section>

      <section className="content-card">
        <h2>سؤالات متداول وزن میلگرد</h2>
        <div className="guide-faq-list">
          {REBAR_WEIGHT_FAQS.map((faq) => (
            <article className="guide-faq-item" key={faq.question}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
        <div className="inline-actions">
          <a href="/rebar/ribbed/">قیمت روز میلگرد آجدار</a>
          <a href="/rebar/">همه گروه میلگرد</a>
          <a href={guidePageUrl("ribbed-vs-plain-rebar")}>
            تفاوت میلگرد آجدار و ساده
          </a>
          <a href={guidePageUrl("units-and-quote-specs")}>واحدهای فروش</a>
        </div>
      </section>
    </>
  );
}
