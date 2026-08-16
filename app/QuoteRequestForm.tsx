import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  FieldErrors,
  validateFullName,
  validatePhone,
  validateRequired,
} from "./form-validation";
import { calculateRebarWeight } from "./catalog-behavior.mjs";
import {
  calculateApproximateTotal,
  loadQuotePriceEstimates,
  type QuotePriceEstimate,
  type QuoteProductName,
} from "./quote-pricing";
import { QuoteDocument } from "./QuoteDocument";
import { quoteDisclaimer, type GeneratedQuote } from "./quote-types";
import { siteConfig } from "./site-config";
import { ErrorMessage, PreparedRequest } from "./request-form-shared";
import { usePreparedRequest } from "./use-prepared-request";

// Standard commercial rebar branch length in Iran; used only to estimate a
// per-branch/per-piece weight when a buyer orders میلگرد by شاخه/عدد instead
// of by weight.
const REBAR_STANDARD_BRANCH_LENGTH_M = 12;

// Products whose catalog has no per-piece data at all (only کیلوگرم rows) —
// شاخه/عدد are hidden for these so the form never offers a unit it can't
// price. میلگرد is handled separately via a real weight formula, so it keeps
// its شاخه/عدد options even though it isn't in PRODUCTS_WITH_PIECE_OPTIONS.
const PRODUCTS_WITHOUT_PIECE_UNITS: readonly QuoteProductName[] = [
  "هاش",
  "ورق فولادی",
  "پروفیل و قوطی",
  "نبشی",
  "ناودانی",
];

function resolvePieceOption(
  pieceOptionKey: string,
  estimate: QuotePriceEstimate | undefined,
) {
  if (!pieceOptionKey || !estimate?.pieceOptions) return undefined;
  return estimate.pieceOptions.find((option) => option.key === pieceOptionKey);
}

function calculateItemTotal(
  item: Pick<
    QuoteItem,
    "product" | "unit" | "quantity" | "rebarDiameterMm" | "pieceOptionKey"
  >,
  estimate: QuotePriceEstimate | undefined,
) {
  if (!estimate) return null;
  const quantity = Number(item.quantity);

  const pieceOption = resolvePieceOption(item.pieceOptionKey, estimate);
  if (pieceOption) {
    return Number.isFinite(quantity) && quantity > 0
      ? Math.round(pieceOption.priceToman * quantity)
      : null;
  }

  if (item.unit === "تن" || item.unit === "کیلوگرم") {
    return calculateApproximateTotal(
      estimate.unitPriceTomanPerKg,
      quantity,
      item.unit,
    );
  }

  if (item.product === "میلگرد" && item.rebarDiameterMm) {
    const weightKg = calculateRebarWeight(
      Number(item.rebarDiameterMm),
      REBAR_STANDARD_BRANCH_LENGTH_M,
      Math.trunc(quantity),
    );
    return weightKg
      ? Math.round(estimate.unitPriceTomanPerKg * weightKg)
      : null;
  }

  return null;
}

const productOptions = [
  "میلگرد",
  "تیرآهن",
  "هاش",
  "ورق فولادی",
  "پروفیل و قوطی",
  "لوله فولادی",
  "نبشی",
  "ناودانی",
  "مفتول و سیم",
  "سایر محصولات فولادی",
] as const satisfies readonly QuoteProductName[];

const MAX_QUOTE_ITEMS = 100;

type QuoteItem = {
  id: number;
  product: QuoteProductName | "";
  quantity: string;
  unit: "تن" | "کیلوگرم" | "شاخه" | "عدد";
  dimensions: string;
  rebarDiameterMm: string;
  // Key of a real catalog item selected for products in
  // PRODUCTS_WITH_PIECE_OPTIONS (e.g. a specific تیرآهن size or a specific
  // رابیتس/توری product) — determines both the real unit and real price.
  pieceOptionKey: string;
};

type QuotePriceEstimates = Partial<
  Record<QuoteProductName, QuotePriceEstimate>
>;

const createQuoteItem = (id: number): QuoteItem => ({
  id,
  product: "",
  quantity: "",
  unit: "تن",
  dimensions: "",
  rebarDiameterMm: "",
  pieceOptionKey: "",
});

const formatToman = (value: number) =>
  `${value.toLocaleString("fa-IR")} تومان`;

const persianDateFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const persianDate = () => persianDateFormatter.format(new Date());

export function QuoteRequestForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<QuoteItem[]>([createQuoteItem(1)]);
  const [targetItemCount, setTargetItemCount] = useState(1);
  const [priceEstimates, setPriceEstimates] =
    useState<QuotePriceEstimates | null>(null);
  const [priceLoadError, setPriceLoadError] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<GeneratedQuote | null>(
    null,
  );
  const nextItemId = useRef(2);
  const prepared = usePreparedRequest();

  const updateFieldError = (field: string, message: string) => {
    setErrors((current) =>
      field in current ? { ...current, [field]: message } : current,
    );
  };

  const validateChangedField = (
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ) => {
    if (element.name === "fullName") {
      updateFieldError("fullName", validateFullName(element.value));
      return;
    }
    if (element.name === "phone") {
      updateFieldError("phone", validatePhone(element.value));
      return;
    }
    if (element.name === "destination") {
      updateFieldError("destination", validateRequired(element.value, "شهر مقصد"));
      return;
    }
    if (element.name === "acceptDisclaimer") {
      updateFieldError(
        "acceptDisclaimer",
        element instanceof HTMLInputElement && element.checked
          ? ""
          : "برای آماده‌سازی درخواست باید متن غیرقطعی‌بودن درخواست را تأیید کنید.",
      );
      return;
    }

    const productMatch = /^itemProduct-(\d+)$/.exec(element.name);
    const quantityMatch = /^itemQuantity-(\d+)$/.exec(element.name);
    const itemId = Number(productMatch?.[1] ?? quantityMatch?.[1]);
    const itemIndex = items.findIndex((item) => item.id === itemId);
    if (itemIndex === -1) return;

    const itemNumber = (itemIndex + 1).toLocaleString("fa-IR");
    if (productMatch) {
      updateFieldError(
        element.name,
        validateRequired(element.value, `نوع کالای ${itemNumber}`),
      );
      return;
    }
    if (quantityMatch) {
      const requiredError = validateRequired(
        element.value,
        `مقدار تقریبی کالای ${itemNumber}`,
      );
      const numericQuantity = Number(element.value);
      updateFieldError(
        element.name,
        requiredError ||
          (!Number.isFinite(numericQuantity) || numericQuantity <= 0
            ? `مقدار تقریبی کالای ${itemNumber} باید عددی بزرگ‌تر از صفر باشد.`
            : ""),
      );
    }
  };

  useEffect(() => {
    let active = true;

    loadQuotePriceEstimates()
      .then((estimates) => {
        if (!active) return;
        setPriceEstimates(estimates);
        setPriceLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setPriceLoadError(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const pricedItems = useMemo(
    () =>
      items.map((item) => {
        const estimate =
          item.product && priceEstimates
            ? priceEstimates[item.product]
            : undefined;
        const approximateTotal = calculateItemTotal(item, estimate);
        const pieceOption = resolvePieceOption(item.pieceOptionKey, estimate);

        return { item, estimate, approximateTotal, pieceOption };
      }),
    [items, priceEstimates],
  );

  const approximateGrandTotal = useMemo(
    () =>
      pricedItems.reduce(
        (sum, pricedItem) => sum + (pricedItem.approximateTotal ?? 0),
        0,
      ),
    [pricedItems],
  );
  const pricedItemCount = pricedItems.filter(
    (pricedItem) => pricedItem.approximateTotal !== null,
  ).length;

  const updateItem = (itemId: number, patch: Partial<QuoteItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      ),
    );
    prepared.clear();
    setGeneratedQuote(null);
  };

  const appendItems = (count: number) => {
    const available = MAX_QUOTE_ITEMS - items.length;
    const amount = Math.min(Math.max(count, 0), available);
    if (!amount) return;

    const additions = Array.from({ length: amount }, () =>
      createQuoteItem(nextItemId.current++),
    );
    setItems((current) => [...current, ...additions]);
    setTargetItemCount(items.length + amount);
    setErrors({});
    prepared.clear();
    setGeneratedQuote(null);
    window.requestAnimationFrame(() => {
      const firstNewProduct = document.querySelector<HTMLElement>(
        `[name="itemProduct-${additions[0].id}"]`,
      );
      firstNewProduct?.focus();
    });
  };

  const applyTargetItemCount = () => {
    const requested = Math.min(
      Math.max(Math.trunc(targetItemCount || 1), 1),
      MAX_QUOTE_ITEMS,
    );
    setTargetItemCount(requested);

    if (requested > items.length) {
      appendItems(requested - items.length);
      return;
    }
    if (requested < items.length) {
      setItems((current) => current.slice(0, requested));
      setErrors({});
      prepared.clear();
      setGeneratedQuote(null);
    }
  };

  const removeItem = (itemId: number) => {
    if (items.length === 1) return;
    setItems((current) => current.filter((item) => item.id !== itemId));
    setTargetItemCount(items.length - 1);
    setErrors({});
    prepared.clear();
    setGeneratedQuote(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "");
    const phone = String(form.get("phone") ?? "");
    const destination = String(form.get("destination") ?? "");
    const notes = String(form.get("notes") ?? "");
    const accepted = form.get("acceptDisclaimer") === "on";

    const nextErrors: FieldErrors = {
      fullName: validateFullName(fullName),
      phone: validatePhone(phone),
    };

    const quoteItems = items.map((item, index) => {
      const productField = `itemProduct-${item.id}`;
      const quantityField = `itemQuantity-${item.id}`;
      const { product, quantity, unit, dimensions, rebarDiameterMm, pieceOptionKey } =
        item;
      const itemNumber = (index + 1).toLocaleString("fa-IR");

      nextErrors[productField] = validateRequired(
        product,
        `نوع کالای ${itemNumber}`,
      );
      nextErrors[quantityField] = validateRequired(
        quantity,
        `مقدار تقریبی کالای ${itemNumber}`,
      );

      const numericQuantity = Number(quantity);
      if (
        !nextErrors[quantityField] &&
        (!Number.isFinite(numericQuantity) || numericQuantity <= 0)
      ) {
        nextErrors[quantityField] =
          `مقدار تقریبی کالای ${itemNumber} باید عددی بزرگ‌تر از صفر باشد.`;
      }

      const estimate =
        product && priceEstimates ? priceEstimates[product] : undefined;
      const pieceOption = resolvePieceOption(pieceOptionKey, estimate);
      const approximateTotal = calculateItemTotal(
        { product, unit, quantity, rebarDiameterMm, pieceOptionKey },
        estimate,
      );
      const effectiveUnit = pieceOption?.unit ?? unit;

      return {
        product,
        quantity,
        unit,
        effectiveUnit,
        pieceOption,
        dimensions,
        estimate,
        approximateTotal,
      };
    });

    nextErrors.destination = validateRequired(destination, "شهر مقصد");
    nextErrors.acceptDisclaimer = accepted
      ? ""
      : "برای آماده‌سازی درخواست باید متن غیرقطعی‌بودن درخواست را تأیید کنید.";

    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      const firstErrorField = Object.entries(nextErrors).find(
        ([, message]) => Boolean(message),
      )?.[0];
      const firstInvalid = firstErrorField
        ? event.currentTarget.elements.namedItem(firstErrorField)
        : null;
      if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
      return;
    }

    prepared.prepare(
      [
        "درخواست پیش‌فاکتور غیرقطعی",
        `نام: ${fullName.trim()}`,
        `شماره تماس: ${phone.trim()}`,
        "",
        `کالاهای درخواست (${quoteItems.length.toLocaleString("fa-IR")} کالا):`,
        ...quoteItems.map((item, index) => {
          const priceDescription =
            item.approximateTotal === null || !item.estimate
              ? " | قیمت تقریبی: نیازمند بررسی واحد فروش"
              : item.pieceOption
                ? ` | قیمت تقریبی: ${formatToman(item.approximateTotal)} (بر اساس قیمت واقعی سایت برای این آیتم: ${formatToman(item.pieceOption.priceToman)} برای هر ${item.pieceOption.unit})`
                : ` | قیمت تقریبی: ${formatToman(item.approximateTotal)} (مبنای محاسبه: ${formatToman(item.estimate.unitPriceTomanPerKg)} برای هر کیلوگرم)`;
          return `${(index + 1).toLocaleString("fa-IR")}) ${item.product.trim()} | ${item.quantity.trim()} ${item.effectiveUnit} | ابعاد/استاندارد: ${item.dimensions.trim() || "اعلام نشده"}${priceDescription}`;
        }),
        "",
        `جمع تقریبی: ${
          quoteItems.some((item) => item.approximateTotal !== null)
            ? formatToman(
                quoteItems.reduce(
                  (sum, item) => sum + (item.approximateTotal ?? 0),
                  0,
                ),
              )
            : "محاسبه نشده"
        }`,
        "قیمت‌های تقریبی بالا صرفاً اطلاع‌رسانی هستند و ممکن است همه کالاها را پوشش ندهند.",
        "",
        `شهر مقصد: ${destination.trim()}`,
        `توضیحات: ${notes.trim() || "ندارد"}`,
        "",
        quoteDisclaimer,
      ].join("\n"),
    );
    setGeneratedQuote({
      date: persianDate(),
      fullName: fullName.trim(),
      phone: phone.trim(),
      destination: destination.trim(),
      notes: notes.trim(),
      items: quoteItems.map((item) => {
        const totalRial =
          item.approximateTotal === null ? null : item.approximateTotal * 10;
        const numericQuantity = Number(item.quantity);
        return {
          product: item.product as QuoteProductName,
          quantity: item.quantity,
          unit: item.effectiveUnit,
          dimensions: item.dimensions,
          unitPriceRial:
            totalRial === null || !numericQuantity
              ? null
              : Math.round(totalRial / numericQuantity),
          totalRial,
        };
      }),
      totalRial: quoteItems.reduce(
        (sum, item) => sum + (item.approximateTotal ?? 0) * 10,
        0,
      ),
    });
  };

  return (
    <form
      className="request-form"
      id="quote-form"
      noValidate
      onSubmit={submit}
      onChange={(event) => {
        prepared.clear();
        setGeneratedQuote(null);
        const element = event.target;
        if (
          element instanceof HTMLInputElement ||
          element instanceof HTMLSelectElement ||
          element instanceof HTMLTextAreaElement
        ) {
          validateChangedField(element);
        }
      }}
    >
      <div className="form-heading">
        <span>فرم محلی</span>
        <h2>آماده‌سازی درخواست پیش‌فاکتور غیرقطعی</h2>
        <p>
          اطلاعات این فرم در مرورگر شما آماده می‌شود و تا زمان تماس یا ارسال
          از طریق ایمیل رسمی، به واحد فروش تحویل نمی‌شود.
        </p>
      </div>
      <div className="form-grid">
        <label>
          نام و نام خانوادگی
          <input
            name="fullName"
            autoComplete="name"
            aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? "quote-name-error" : undefined}
          />
          <ErrorMessage id="quote-name-error" message={errors.fullName} />
        </label>
        <label>
          شماره تماس
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            placeholder="09121234567"
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "quote-phone-error" : undefined}
          />
          <ErrorMessage id="quote-phone-error" message={errors.phone} />
        </label>
        <label>
          شهر مقصد
          <input
            name="destination"
            autoComplete="address-level2"
            aria-invalid={Boolean(errors.destination)}
            aria-describedby={
              errors.destination ? "quote-destination-error" : undefined
            }
          />
          <ErrorMessage
            id="quote-destination-error"
            message={errors.destination}
          />
        </label>
        <label className="form-wide">
          توضیحات تکمیلی
          <textarea name="notes" rows={4} maxLength={1000} />
        </label>
      </div>
      <section className="quote-items" aria-labelledby="quote-items-heading">
        <div className="quote-items-heading">
          <div>
            <span>کالاهای پیش‌فاکتور</span>
            <h3 id="quote-items-heading">
              محصولات موردنیاز را در یک درخواست وارد کنید
            </h3>
            <p>
              می‌توانید تا {MAX_QUOTE_ITEMS.toLocaleString("fa-IR")} کالا را
              داخل همین پیش‌فاکتور وارد کنید.
            </p>
          </div>
          <div className="quote-item-count">
            <label htmlFor="quote-item-count">تعداد کالاها</label>
            <input
              id="quote-item-count"
              type="number"
              min="1"
              max={MAX_QUOTE_ITEMS}
              value={targetItemCount}
              onChange={(event) =>
                setTargetItemCount(Number(event.currentTarget.value))
              }
            />
            <button type="button" onClick={applyTargetItemCount}>
              ساخت ردیف‌ها
            </button>
          </div>
        </div>
        <div className="quote-items-list">
          {items.map((item, index) => {
            const itemNumber = (index + 1).toLocaleString("fa-IR");
            const productField = `itemProduct-${item.id}`;
            const quantityField = `itemQuantity-${item.id}`;
            const productErrorId = `quote-product-${item.id}-error`;
            const quantityErrorId = `quote-quantity-${item.id}-error`;
            const pricedItem = pricedItems[index];

            return (
              <fieldset className="quote-item-card" key={item.id}>
                <legend>کالای {itemNumber}</legend>
                {items.length > 1 ? (
                  <button
                    className="remove-quote-item"
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`حذف کالای ${itemNumber}`}
                  >
                    حذف این کالا
                  </button>
                ) : null}
                <div className="quote-item-grid">
                  <label>
                    نوع محصول
                    <select
                      name={productField}
                      value={item.product}
                      onChange={(event) =>
                        updateItem(item.id, {
                          product: event.currentTarget
                            .value as QuoteItem["product"],
                          rebarDiameterMm: "",
                          pieceOptionKey: "",
                        })
                      }
                      aria-invalid={Boolean(errors[productField])}
                      aria-describedby={
                        errors[productField] ? productErrorId : undefined
                      }
                    >
                      <option value="" disabled>
                        انتخاب کنید
                      </option>
                      {productOptions.map((product) => (
                        <option key={product}>{product}</option>
                      ))}
                    </select>
                    <ErrorMessage
                      id={productErrorId}
                      message={errors[productField]}
                    />
                  </label>
                  <label>
                    مقدار تقریبی
                    <span className="compound-field">
                      <input
                        name={quantityField}
                        type="number"
                        min="0.01"
                        step="any"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(item.id, {
                            quantity: event.currentTarget.value,
                          })
                        }
                        aria-invalid={Boolean(errors[quantityField])}
                        aria-describedby={
                          errors[quantityField]
                            ? quantityErrorId
                            : undefined
                        }
                      />
                      <select
                        name={`itemUnit-${item.id}`}
                        aria-label={`واحد مقدار کالای ${itemNumber}`}
                        value={item.unit}
                        onChange={(event) =>
                          updateItem(item.id, {
                            unit: event.currentTarget.value as QuoteItem["unit"],
                            pieceOptionKey: "",
                          })
                        }
                      >
                        <option>تن</option>
                        <option>کیلوگرم</option>
                        {!PRODUCTS_WITHOUT_PIECE_UNITS.includes(
                          item.product as QuoteProductName,
                        ) ? (
                          <>
                            <option>شاخه</option>
                            <option>عدد</option>
                          </>
                        ) : null}
                      </select>
                    </span>
                    <ErrorMessage
                      id={quantityErrorId}
                      message={errors[quantityField]}
                    />
                  </label>
                  <label>
                    ابعاد، گرید یا استاندارد
                    <input
                      name={`itemDimensions-${item.id}`}
                      placeholder="مثلاً میلگرد A3 سایز 16"
                      value={item.dimensions}
                      onChange={(event) =>
                        updateItem(item.id, {
                          dimensions: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  {item.product === "میلگرد" &&
                  (item.unit === "شاخه" || item.unit === "عدد") ? (
                    <label className="quote-item-rebar-size">
                      قطر میلگرد برای محاسبه وزن (میلی‌متر)
                      <input
                        name={`itemRebarDiameter-${item.id}`}
                        type="number"
                        min="4"
                        step="0.5"
                        inputMode="decimal"
                        placeholder="مثلاً 8"
                        value={item.rebarDiameterMm}
                        onChange={(event) =>
                          updateItem(item.id, {
                            rebarDiameterMm: event.currentTarget.value,
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {pricedItem.estimate?.pieceOptions &&
                  (item.unit === "شاخه" || item.unit === "عدد") ? (
                    <label className="quote-item-rebar-size">
                      انتخاب دقیق از فهرست قیمت سایت
                      <select
                        name={`itemPieceOption-${item.id}`}
                        value={item.pieceOptionKey}
                        onChange={(event) =>
                          updateItem(item.id, {
                            pieceOptionKey: event.currentTarget.value,
                          })
                        }
                      >
                        <option value="">انتخاب کنید</option>
                        {(pricedItem.estimate?.pieceOptions ?? []).map(
                          (option) => (
                            <option key={option.key} value={option.key}>
                              {option.label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="quote-item-price" aria-live="polite">
                  {!priceEstimates && !priceLoadError ? (
                    <span>در حال دریافت قیمت تقریبی از داده‌های سایت…</span>
                  ) : priceLoadError ? (
                    <span>
                      دریافت قیمت تقریبی ممکن نشد؛ برای قیمت روز با واحد فروش
                      تماس بگیرید.
                    </span>
                  ) : !item.product ? (
                    <span>
                      پس از انتخاب کالا و واردکردن مقدار، قیمت تقریبی نمایش داده
                      می‌شود.
                    </span>
                  ) : !pricedItem.estimate ? (
                    <span>
                      برای این کالا قیمت وزنی قابل محاسبه نیست؛ با واحد فروش
                      تماس بگیرید.
                    </span>
                  ) : (item.unit === "شاخه" || item.unit === "عدد") &&
                    item.product === "میلگرد" &&
                    !item.rebarDiameterMm ? (
                    <span>
                      برای محاسبه قیمت بر اساس {item.unit}، قطر میلگرد
                      (میلی‌متر) را در فیلد بالا وارد کنید.
                    </span>
                  ) : (item.unit === "شاخه" || item.unit === "عدد") &&
                    pricedItem.estimate?.pieceOptions &&
                    !item.pieceOptionKey ? (
                    <span>
                      برای محاسبه قیمت، آیتم دقیق را از فهرست قیمت سایت در
                      فیلد بالا انتخاب کنید.
                    </span>
                  ) : pricedItem.approximateTotal === null ? (
                    <span>
                      برای مشاهده برآورد، مقدار معتبر بزرگ‌تر از صفر وارد کنید.
                    </span>
                  ) : item.product === "میلگرد" &&
                    (item.unit === "شاخه" || item.unit === "عدد") ? (
                    <>
                      <span>
                        میانگین داده قیمت سایت:{" "}
                        <strong>
                          {formatToman(
                            pricedItem.estimate.unitPriceTomanPerKg,
                          )}
                        </strong>{" "}
                        برای هر کیلوگرم (بر اساس وزن تقریبی هر {item.unit} با
                        فرمول استاندارد میلگرد و طول شاخه{" "}
                        {REBAR_STANDARD_BRANCH_LENGTH_M} متر)
                      </span>
                      <span>
                        قیمت تقریبی این کالا:{" "}
                        <strong>
                          {formatToman(pricedItem.approximateTotal)}
                        </strong>
                      </span>
                    </>
                  ) : pricedItem.pieceOption ? (
                    <>
                      <span>
                        قیمت واقعی سایت برای {pricedItem.pieceOption.label}:{" "}
                        <strong>
                          {formatToman(pricedItem.pieceOption.priceToman)}
                        </strong>{" "}
                        برای هر {pricedItem.pieceOption.unit}
                      </span>
                      <span>
                        قیمت تقریبی این کالا:{" "}
                        <strong>
                          {formatToman(pricedItem.approximateTotal)}
                        </strong>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        میانگین داده قیمت سایت:{" "}
                        <strong>
                          {formatToman(
                            pricedItem.estimate.unitPriceTomanPerKg,
                          )}
                        </strong>{" "}
                        برای هر کیلوگرم
                      </span>
                      <span>
                        قیمت تقریبی این کالا:{" "}
                        <strong>
                          {formatToman(pricedItem.approximateTotal)}
                        </strong>
                      </span>
                    </>
                  )}
                </div>
              </fieldset>
            );
          })}
        </div>
        <button
          className="add-quote-item"
          type="button"
          onClick={() => appendItems(1)}
          disabled={items.length >= MAX_QUOTE_ITEMS}
        >
          + افزودن کالای جدید
        </button>
      </section>
      <section className="quote-price-summary" aria-live="polite">
        <span>جمع تقریبی پیش‌فاکتور</span>
        <strong>
          {pricedItemCount
            ? formatToman(approximateGrandTotal)
            : "هنوز قابل محاسبه نیست"}
        </strong>
        <p>
          {pricedItemCount
            ? `جمع ${pricedItemCount.toLocaleString("fa-IR")} از ${items.length.toLocaleString("fa-IR")} کالا محاسبه شده است. `
            : ""}
          این مبلغ از داده‌های قیمت فعلی سایت محاسبه می‌شود (برای واحد تن و
          کیلوگرم مستقیم، برای شاخه/عدد میلگرد بر اساس وزن تقریبی، و برای
          تیرآهن، لوله فولادی و مفتول و سیم بر اساس آیتم دقیق انتخابی از فهرست
          قیمت سایت)، نهایی نیست و برای تأیید قیمت و موجودی باید با واحد فروش
          تماس بگیرید.
        </p>
      </section>
      <div className="legal-confirmation">
        <p>{quoteDisclaimer}</p>
        <label>
          <input
            name="acceptDisclaimer"
            type="checkbox"
            aria-invalid={Boolean(errors.acceptDisclaimer)}
            aria-describedby={
              errors.acceptDisclaimer ? "quote-disclaimer-error" : undefined
            }
          />
          متن بالا را خواندم و می‌پذیرم.
        </label>
        <ErrorMessage
          id="quote-disclaimer-error"
          message={errors.acceptDisclaimer}
        />
      </div>
      <button className="form-submit" type="submit">
        بررسی و آماده‌سازی درخواست
      </button>
      {generatedQuote ? (
        <QuoteDocument
          quote={generatedQuote}
          onCopy={prepared.copy}
          copyMessage={prepared.copyMessage}
        />
      ) : (
        <PreparedRequest
          title="پیش‌نویس درخواست پیش‌فاکتور"
          preparedText={prepared.preparedText}
          copyMessage={prepared.copyMessage}
          resultRef={prepared.resultRef}
          onCopy={prepared.copy}
          contactLabel="تماس با واحد فروش"
          contactHref={siteConfig.contact.phones[0].href}
        />
      )}
    </form>
  );
}
