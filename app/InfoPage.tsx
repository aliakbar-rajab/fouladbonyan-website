import { useEffect, useState } from "react";
import { ComplaintForm } from "./ComplaintForm";
import { QuoteRequestForm } from "./QuoteRequestForm";
import { siteConfig } from "./site-config";
import { LightPillar } from "./LightPillar";
import { SiteFooter } from "./SiteFooter";
import { Brand } from "./site-ui";
import { useMediaQuery } from "./use-media-query";
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
        <p>قیمت و شرایط نهایی پس از تماس با واحد فروش اعلام میشود.</p>
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
          زمان دقیق پاسخ‌گویی و سازوکار تخصیص کد پیگیری باید پس از تأیید مالک
          سایت در تنظیمات مرکزی تکمیل شود؛ سایت در وضعیت فعلی کد ساختگی تولید
          نمی‌کند.
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const isMobile = useMediaQuery("(max-width: 900px)");

  useEffect(() => {
    document.title = `${definition.title} | ${siteConfig.brand.name}`;
  }, [definition.title]);

  return (
    <div id="fb-site" className="inner-page">
      <a className="skip-link" href="#main-content">
        رفتن به محتوای اصلی
      </a>
      <div className="utility-bar" id="top">
        <div className="shell utility-inner">
          <p>مشاوره و استعلام تلفنی محصولات فولادی</p>
          <div aria-label="شماره‌های تماس">
            {siteConfig.contact.phones.map((phone) => (
              <a href={phone.href} key={phone.href} dir="ltr">
                {phone.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <header className="site-header">
        <LightPillar
          topColor="#f6b500"
          bottomColor="#000000"
          intensity={0.8}
          rotationSpeed={0.15}
          glowAmount={0.005}
          pillarWidth={5}
          pillarHeight={0.28}
          noiseIntensity={0.1}
          pillarRotation={-15}
          interactive={false}
          mixBlendMode="normal"
        />
        <div className="shell header-main inner-header-main">
          <Brand headerLogo href="/" />
          <a className="contact-header-catalog" href="/#products">
            <span>قیمت‌های اطلاع‌رسانی و مشخصات محصولات</span>
            <strong>مشاهده محصولات</strong>
          </a>
          <a className="header-phone" href={siteConfig.contact.phones[0].href}>
            <span aria-hidden="true">☎</span>
            <span>
              <small>تماس با واحد فروش</small>
              <b dir="ltr">{siteConfig.contact.phones[0].label}</b>
            </span>
          </a>
          <button
            className="nav-toggle"
            type="button"
            aria-expanded={mobileNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <span aria-hidden="true">{mobileNavOpen ? "×" : "☰"}</span>
            <span className="sr-only">فهرست اصلی</span>
          </button>
        </div>
        <div className="nav-wrap">
          <nav
            className="shell primary-nav"
            id="primary-navigation"
            aria-label="فهرست اصلی"
            hidden={isMobile && !mobileNavOpen}
          >
            <a href="/">صفحه اصلی</a>
            <a href="/#products">محصولات</a>
            <a href="/#prices">قیمت‌های اطلاع‌رسانی</a>
            <a href="/about/">درباره ما</a>
            <a href="/contact/">تماس با ما</a>
            <a className="nav-quote" href="/quote-process/#quote-form">
              درخواست پیش‌فاکتور
            </a>
          </nav>
        </div>
      </header>
      <main id="main-content" className="info-main">
        <section className="info-hero">
          <div className="shell">
            <span>{definition.eyebrow}</span>
            <h1>{definition.title}</h1>
            <p>{definition.description}</p>
          </div>
        </section>
        <div className="shell info-content">
          <PageContent page={page} />
        </div>
      </main>
      <SiteFooter />
      <div className="mobile-actions" aria-label="اقدام‌های سریع">
        <a href={siteConfig.contact.phones[0].href}>
          <span aria-hidden="true">☎</span>
          تماس
        </a>
        <a href="/quote-process/#quote-form">درخواست پیش‌فاکتور</a>
      </div>
    </div>
  );
}
