import { ComplaintForm } from "./ComplaintForm";
import { QuoteRequestForm } from "./QuoteRequestForm";
import { siteConfig } from "./site-config";
import { InnerPageLayout } from "./InnerPageLayout";
import {
  infoPageDefinitions,
  type InfoPageKey,
} from "./info-page-data";

function AboutContent() {
  return (
    <>
      <section className="content-card">
        <h2>حوزه فعالیت</h2>
        <p>
          بنیان فولاد داریا در زمینه معرفی، استعلام و هماهنگی تأمین انواع
          میلگرد، تیرآهن، هاش، ورق، پروفیل، لوله، نبشی، ناودانی و محصولات
          مفتولی برای نیازهای ساختمانی و صنعتی فعالیت می‌کند. این وب‌سایت
          ویترین محصولات و مسیر ارتباط با واحد فروش است.
        </p>
        <p>
          خدمات سایت شامل نمایش قیمت‌های اطلاع‌رسانی، دریافت مشخصات موردنیاز
          مشتری، درخواست پیش‌فاکتور غیرقطعی و هماهنگی تلفنی است. خرید آنلاین،
          پرداخت اینترنتی، سبد خرید و ثبت سفارش قطعی در سایت انجام نمی‌شود.
        </p>
      </section>
      <section className="content-card">
        <h2>رویکرد ما</h2>
        <ul className="checked-list">
          <li>
            بررسی نوع محصول، استاندارد، ابعاد، مقدار و شهر مقصد پیش از اعلام
            شرایط
          </li>
          <li>
            اعلام شفاف اینکه قیمت‌های وب‌سایت قطعی نیستند و باید تأیید شوند
          </li>
          <li>
            مشخص‌کردن مدت اعتبار، موجودی و شرایط تحویل در پیش‌فاکتور نهایی
          </li>
          <li>پاسخ‌گویی تلفنی واحد فروش و امکان ارتباط مستقیم با مدیریت</li>
        </ul>
      </section>
      <section className="content-card">
        <h2>نام و راه‌های ارتباطی</h2>
        <p>
          این مجموعه با نام «{siteConfig.brand.name}» و نام انگلیسی «
          {siteConfig.brand.alternateName}» معرفی می‌شود. نشانی دفتر، کد پستی،
          شماره‌های ثابت و مسیرهای نقشه در صفحه تماس با ما درج شده‌اند.
        </p>
        <div className="inline-actions">
          <a href="/contact/">مشاهده اطلاعات تماس</a>
          <a href="/quote-process/">درخواست پیش‌فاکتور</a>
        </div>
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <section className="content-card legal-copy">
        <h2>ماهیت خدمات وب‌سایت</h2>
        <p>
          این وب‌سایت فروشگاه اینترنتی نیست. مشاهده محصول، تکمیل فرم، تماس
          تلفنی یا آماده‌سازی متن درخواست، به معنی ثبت سفارش، فروش قطعی،
          انعقاد قرارداد یا ایجاد تعهد برای هیچ‌یک از طرفین نیست.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>قیمت و موجودی</h2>
        <p>
          قیمت‌های نمایش‌داده‌شده صرفاً برای اطلاع‌رسانی و شناخت حدود بازار
          هستند و ممکن است با تغییر بازار، مشخصات کالا، مقدار، مالیات، هزینه
          حمل یا محل تحویل تغییر کنند. قیمت، موجودی و زمان تحویل فقط پس از
          بررسی واحد فروش و در پیش‌فاکتور دارای مدت اعتبار قابل استناد است.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>درخواست پیش‌فاکتور و قرارداد</h2>
        <p>
          پیش‌فاکتور پیشنهادی غیرقطعی است مگر اینکه شرایط، مدت اعتبار و نحوه
          پذیرش آن صریحاً اعلام شده باشد. قرارداد یا سفارش قطعی تنها خارج از
          وب‌سایت و پس از توافق روشن طرفین شکل می‌گیرد.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>درستی اطلاعات و استفاده مجاز</h2>
        <p>
          کاربر باید اطلاعات تماس و مشخصات فنی را صحیح وارد کند. استفاده
          اخلال‌گرانه، تلاش برای دسترسی غیرمجاز، بازنشر گمراه‌کننده قیمت‌ها یا
          معرفی خود به‌عنوان نماینده مجموعه مجاز نیست. برای تصمیم فنی یا مالی
          مهم، اطلاعات را با کارشناس مربوط تأیید کنید.
        </p>
        <p className="page-updated">آخرین به‌روزرسانی: ۷ مرداد ۱۴۰۵</p>
      </section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <section className="content-card legal-copy">
        <h2>اطلاعاتی که کاربر وارد می‌کند</h2>
        <p>
          فرم پیش‌فاکتور می‌تواند نام، شماره تماس، نوع و مقدار محصول، مقصد و
          توضیحات فنی را دریافت کند. فرم شکایت نیز نام، شماره تماس، مرجع قبلی،
          موضوع و شرح درخواست را می‌گیرد.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>عملکرد فعلی فرم‌ها</h2>
        <p>
          در نسخه فعلی، فرم‌ها اطلاعات را به سرور ارسال یا در پایگاه داده
          ذخیره نمی‌کنند؛ فقط یک متن قابل کپی در همان مرورگر آماده می‌شود.
          ثبت نهایی زمانی انجام می‌شود که کاربر از راه ارتباطی اعلام‌شده با
          واحد فروش یا مدیریت تماس بگیرد.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>ذخیره محلی و خدمات بیرونی</h2>
        <p>
          سایت فقط برای جلوگیری از تکرار پیش‌بارگذار، یک نشانگر موقت در نشست
          مرورگر نگه می‌دارد. لینک‌های نقشه کاربر را به سرویس‌های بیرونی مانند
          نشان، گوگل‌مپ یا ویز هدایت می‌کنند و استفاده از آن‌ها تابع سیاست
          حریم خصوصی همان سرویس است.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>حقوق و تماس</h2>
        <p>
          برای پرسش درباره اطلاعات شخصی یا درخواست اصلاح اطلاعاتی که در تماس
          تلفنی ارائه کرده‌اید، با مدیریت مجموعه تماس بگیرید
          {siteConfig.contact.officialEmail ? (
            <>
              {" "}
              یا به ایمیل رسمی{" "}
              <a href={`mailto:${siteConfig.contact.officialEmail}`}>
                {siteConfig.contact.officialEmail}
              </a>{" "}
              پیام دهید.
            </>
          ) : (
            "."
          )}
        </p>
        <p className="page-updated">آخرین به‌روزرسانی: ۷ مرداد ۱۴۰۵</p>
      </section>
    </>
  );
}

function QuoteProcessContent() {
  return (
    <>
      <ol className="process-steps">
        <li>
          <strong>آماده‌کردن مشخصات</strong>
          <span>نوع محصول، گرید، ابعاد، مقدار تقریبی و شهر مقصد را مشخص کنید.</span>
        </li>
        <li>
          <strong>ارسال برای بررسی</strong>
          <span>
            متن درخواست را آماده کنید و از طریق شماره‌های رسمی با واحد فروش در
            میان بگذارید.
          </span>
        </li>
        <li>
          <strong>بررسی واحد فروش</strong>
          <span>
            موجودی، منبع تأمین، قیمت، مالیات، هزینه حمل و زمان احتمالی تحویل
            بررسی می‌شود.
          </span>
        </li>
        <li>
          <strong>اعلام پیش‌فاکتور</strong>
          <span>
            قیمت و شرایط نهایی در پیش‌فاکتور دارای مدت اعتبار اعلام می‌شود.
          </span>
        </li>
      </ol>
      <aside className="important-notice">
        <strong>توجه مهم</strong>
        <p>قیمت و شرایط نهایی پس از تماس با واحد فروش اعلام می‌شود.</p>
        <a className="important-notice-phones-link" href="#phone-numbers">
          مشاهده شماره‌های تماس
        </a>
      </aside>
      <QuoteRequestForm />
    </>
  );
}

function ComplaintsContent() {
  return (
    <>
      <section className="content-card">
        <h2>روش ثبت و پیگیری</h2>
        <ol>
          <li>شرح موضوع، تاریخ، شماره تماس و هر مرجع قبلی را آماده کنید.</li>
          <li>متن زیر را آماده و برای ثبت نهایی با مدیریت تماس بگیرید.</li>
          <li>کد یا مرجع اعلام‌شده در تماس را برای پیگیری بعدی نگه دارید.</li>
          <li>
            هنگام پیگیری، همان شماره تماس و کد مرجع را در اختیار پاسخ‌گو قرار
            دهید.
          </li>
        </ol>
        <p>
          پس از ثبت موضوع، کارشناسان ما جزئیات را بررسی کرده و نتیجه را از طریق
          شماره تماس اعلام‌شده پیگیری و اطلاع‌رسانی می‌کنند.
        </p>
      </section>
      <ComplaintForm />
    </>
  );
}

function ShippingContent() {
  return (
    <>
      <section className="content-card legal-copy">
        <h2>تعیین شرایط پیش از ارسال</h2>
        <p>
          روش حمل، مقصد، هزینه، زمان تقریبی، مسئول پرداخت کرایه، نحوه تخلیه و
          مدارک همراه کالا پس از بررسی محصول و در پیش‌فاکتور یا توافق جداگانه
          اعلام می‌شود. هیچ هزینه یا زمان ثابتی صرفاً بر اساس اطلاعات سایت
          تضمین نمی‌شود.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>زمان تحویل</h2>
        <p>
          زمان اعلامی تقریبی است و به تأیید موجودی، آماده‌سازی بار، ظرفیت
          ناوگان، مسیر، محدودیت‌های ترافیکی و شرایط خارج از کنترل وابسته است.
          زمان تعهدآور فقط باید در توافق نهایی به‌صراحت درج شود.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>تحویل و بازرسی</h2>
        <p>
          تحویل‌گیرنده باید پیش از تخلیه یا امضای رسید، مشخصات ظاهری بار،
          تعداد یا وزن مندرج در مدارک و هر آسیب قابل مشاهده را بررسی کند.
          مغایرت باید بلافاصله ثبت و به واحد فروش اطلاع داده شود.
        </p>
      </section>
      <section className="content-card legal-copy">
        <h2>تخلیه و دسترسی محل</h2>
        <p>
          آماده‌بودن محل، امکان ورود وسیله حمل، تجهیزات و نیروی تخلیه بر اساس
          توافق نهایی مشخص می‌شود. مسئولیت این موارد نباید بدون درج صریح در
          پیش‌فاکتور یا قرارداد به یکی از طرفین نسبت داده شود.
        </p>
      </section>
    </>
  );
}

function PageContent({ page }: { page: InfoPageKey }) {
  if (page === "about") return <AboutContent />;
  if (page === "terms") return <TermsContent />;
  if (page === "privacy") return <PrivacyContent />;
  if (page === "quote-process") return <QuoteProcessContent />;
  if (page === "complaints") return <ComplaintsContent />;
  return <ShippingContent />;
}

export default function InfoPage({ page }: { page: InfoPageKey }) {
  const definition = infoPageDefinitions[page];

  return (
    <InnerPageLayout
      documentTitle={`${definition.title} | ${siteConfig.brand.name}`}
      eyebrow={definition.eyebrow}
      title={definition.title}
      description={definition.description}
      // Only /about/ is one of the primary destinations today; the rest simply
      // match nothing, the same way the contact page's own href does its job.
      currentHref={`/${page}/`}
      breadcrumbItems={[
        { label: "صفحه اصلی", href: "/" },
        { label: definition.title },
      ]}
    >
      <PageContent page={page} />
    </InnerPageLayout>
  );
}
