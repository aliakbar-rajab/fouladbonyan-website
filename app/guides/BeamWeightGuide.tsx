import { toPersianDigits } from "../catalog-utils";
import { guidePageUrl } from "../guide-page-data";
import { siteConfig } from "../site-config";
import type { GuideReference } from "../steel-reference";
import { fa, list } from "./GuideShared";

export function BeamWeightGuide({ reference }: { reference: GuideReference }) {
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
              سایز، برداشت‌شده از داده{" "}
              <time dateTime={reference.sourceDateIso}>
                {reference.sourceDateLabel}
              </time>
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
