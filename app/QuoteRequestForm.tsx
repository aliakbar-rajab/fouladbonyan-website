import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { formatCatalogNumber } from "./catalog-utils";
import {
  FieldErrors,
  focusFirstError,
  setFieldError,
} from "./form-validation";
import {
  createQuoteEvaluator,
  formatToman,
  isQuoteProduct,
  isQuoteUnit,
  loadQuoteEvaluator,
  quoteDisclaimer,
  quoteProductNames,
  quoteUnits,
  type GeneratedQuote,
  type QuoteEvaluator,
  type QuoteItemEvaluation,
  type RawQuoteItem,
} from "./quote-engine";
import { QuoteDocument } from "./QuoteDocument";
import { ErrorMessage } from "./request-form-shared";
import { usePreparedRequest } from "./use-prepared-request";

const MAX_QUOTE_ITEMS = 100;

const createQuoteItem = (id: number): RawQuoteItem => ({
  id,
  product: "",
  quantity: "",
  unit: "تن",
  dimensions: "",
  rebarDiameterMm: "",
  pieceOptionKey: "",
});

/**
 * Render line item pricing status or estimate details.
 */
function ItemPriceHint({
  priced,
  loading,
  loadError,
}: {
  priced: QuoteItemEvaluation;
  loading: boolean;
  loadError: boolean;
}) {
  const {
    product,
    quantity,
    unit,
    approximateTotalToman,
    pieceOption,
    requiresRebarDiameter,
  } = priced;
  const byPiece = unit === "شاخه" || unit === "عدد";

  if (loading) {
    return <span>در حال دریافت قیمت تقریبی از داده‌های سایت…</span>;
  }
  if (loadError) {
    return (
      <span>
        دریافت قیمت تقریبی ممکن نشد؛ برای قیمت روز با واحد فروش تماس بگیرید.
      </span>
    );
  }
  if (!product) {
    return (
      <span>
        پس از انتخاب کالا و واردکردن مقدار، قیمت تقریبی نمایش داده می‌شود.
      </span>
    );
  }
  if (byPiece && requiresRebarDiameter && !priced.rebarDiameterMm) {
    return (
      <span>
        برای محاسبه قیمت بر اساس {unit}، قطر میلگرد (میلی‌متر) را در فیلد
        بالا وارد کنید.
      </span>
    );
  }
  if (byPiece && priced.pieceOption && !priced.pieceOptionKey) {
    return (
      <span>
        برای محاسبه قیمت، آیتم دقیق را از فهرست قیمت سایت در فیلد بالا انتخاب
        کنید.
      </span>
    );
  }
  if (approximateTotalToman === null || !quantity.trim()) {
    return <span>برای مشاهده برآورد، مقدار معتبر بزرگ‌تر از صفر وارد کنید.</span>;
  }

  return (
    <>
      {pieceOption ? (
        <span>
          قیمت واقعی سایت برای {pieceOption.label}:{" "}
          <strong>{formatToman(pieceOption.priceToman)}</strong> برای هر{" "}
          {pieceOption.unit}
        </span>
      ) : (
        <span>
          {priced.weightInKg && (
            <>
              میانگین داده قیمت سایت:{" "}
              <strong>
                {formatToman(
                  Math.round(approximateTotalToman / priced.weightInKg),
                )}
              </strong>{" "}
              برای هر کیلوگرم
            </>
          )}
          {requiresRebarDiameter && byPiece
            ? " (بر اساس وزن تقریبی هر شاخه با فرمول استاندارد میلگرد و طول شاخه ۱۲ متر)"
            : null}
        </span>
      )}
      <span>
        قیمت تقریبی این کالا: <strong>{formatToman(approximateTotalToman)}</strong>
      </span>
    </>
  );
}

export function QuoteRequestForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<RawQuoteItem[]>([createQuoteItem(1)]);
  const [evaluator, setEvaluator] = useState<QuoteEvaluator | null>(null);
  const [priceLoadError, setPriceLoadError] = useState(false);
  const [generatedQuote, setGeneratedQuote] = useState<GeneratedQuote | null>(
    null,
  );
  const nextItemId = useRef(2);
  const prepared = usePreparedRequest();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedProduct = params.get("product");
    const requestedDimensions = params.get("dimensions")?.slice(0, 240) ?? "";
    const matchedProduct = quoteProductNames.find(
      (product) => product === requestedProduct,
    );
    if (!matchedProduct && !requestedDimensions) return;

    const frame = window.requestAnimationFrame(() => {
      setItems((current) => {
        const first = current[0];
        if (!first || first.product || first.dimensions) return current;
        return [
          {
            ...first,
            product: matchedProduct ?? "",
            dimensions: requestedDimensions,
          },
          ...current.slice(1),
        ];
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const activeEvaluator = useMemo(
    () => evaluator ?? createQuoteEvaluator(),
    [evaluator],
  );

  const validateChangedField = (
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ) => {
    const { name, value } = element;
    const isCheckbox =
      element instanceof HTMLInputElement && element.type === "checkbox";
    const fieldValue = isCheckbox ? element.checked : value;
    const errorMsg = activeEvaluator.validateField(name, fieldValue);
    setFieldError(setErrors, name, errorMsg);
  };

  useEffect(() => {
    let active = true;
    loadQuoteEvaluator()
      .then((instance) => {
        if (!active) return;
        setEvaluator(instance);
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

  const { items: pricedItems, totals } = useMemo(
    () => activeEvaluator.evaluateItems(items),
    [items, activeEvaluator],
  );

  const clearDraft = () => {
    prepared.clear();
    setGeneratedQuote(null);
  };

  const updateItem = (itemId: number, patch: Partial<RawQuoteItem>) => {
    setItems((current) => {
      const next = current.map((item) =>
        item.id === itemId ? { ...item, ...patch } : item,
      );
      const index = next.findIndex((item) => item.id === itemId);
      if (index !== -1) {
        if ("product" in patch) {
          const errorMsg = activeEvaluator.validateField(
            "product",
            patch.product,
            { itemIndex: index },
          );
          setFieldError(setErrors, `itemProduct-${itemId}`, errorMsg);
        }
        if ("quantity" in patch || "unit" in patch) {
          const errorMsg = activeEvaluator.validateField(
            "quantity",
            next[index].quantity,
            { unit: next[index].unit, itemIndex: index },
          );
          setFieldError(setErrors, `itemQuantity-${itemId}`, errorMsg);
        }
      }
      return next;
    });
    clearDraft();
  };

  const addItem = () => {
    if (items.length >= MAX_QUOTE_ITEMS) return;
    const added = createQuoteItem(nextItemId.current++);
    setItems((current) => [...current, added]);
    setErrors({});
    clearDraft();
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(`[name="itemProduct-${added.id}"]`)
        ?.focus();
    });
  };

  const removeItem = (itemId: number) => {
    if (items.length === 1) return;
    setItems((current) => current.filter((item) => item.id !== itemId));
    setErrors({});
    clearDraft();
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const contact = {
      fullName: String(form.get("fullName") ?? ""),
      phone: String(form.get("phone") ?? ""),
      destination: String(form.get("destination") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };

    const evaluation = activeEvaluator.evaluateRequest({
      contact,
      items,
      acceptDisclaimer: form.get("acceptDisclaimer") === "on",
    });

    setErrors(evaluation.validation.errors);
    if (focusFirstError(event.currentTarget, evaluation.validation.errors)) {
      return;
    }

    prepared.prepare(evaluation.message);
    setGeneratedQuote(evaluation.document);
  };

  return (
    <form
      className="request-form"
      id="quote-form"
      noValidate
      onSubmit={submit}
      onChange={(event) => {
        clearDraft();
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
            placeholder="۰۹۱۲۱۲۳۴۵۶۷"
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
        </div>
        <div className="quote-items-list">
          {pricedItems.map((priced, index) => {
            const { product, unit, id, pieceOptionKey, rebarDiameterMm, dimensions } = priced;
            const number = formatCatalogNumber(index + 1);
            const productField = `itemProduct-${id}`;
            const quantityField = `itemQuantity-${id}`;
            const productErrorId = `quote-product-${id}-error`;
            const quantityErrorId = `quote-quantity-${id}-error`;
            const priceHintId = `quote-price-${id}-hint`;

            const hidePieceUnits = !activeEvaluator.supportsPieceUnits(product);
            const pieceOptions = activeEvaluator.getPieceOptions(product);
            const requiresRebar = activeEvaluator.requiresRebarDiameter(product);
            const isPiece = unit === "شاخه" || unit === "عدد";

            return (
              <fieldset className="quote-item-card" key={id}>
                <legend>کالای {number}</legend>
                {items.length > 1 ? (
                  <button
                    className="remove-quote-item"
                    type="button"
                    onClick={() => removeItem(id)}
                    aria-label={`حذف کالای ${number}`}
                  >
                    حذف این کالا
                  </button>
                ) : null}
                <div className="quote-item-grid">
                  <label>
                    نوع محصول
                    <select
                      name={productField}
                      value={product}
                      onChange={(event) => {
                        const val = event.currentTarget.value;
                        if (isQuoteProduct(val)) {
                          updateItem(id, {
                            product: val,
                            rebarDiameterMm: "",
                            pieceOptionKey: "",
                          });
                        }
                      }}
                      aria-invalid={Boolean(errors[productField])}
                      aria-describedby={
                        errors[productField] ? productErrorId : undefined
                      }
                    >
                      <option value="" disabled>
                        انتخاب کنید
                      </option>
                      {quoteProductNames.map((p) => (
                        <option key={p}>{p}</option>
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
                        min={isPiece ? "1" : "0.01"}
                        step={isPiece ? "1" : "any"}
                        inputMode={isPiece ? "numeric" : "decimal"}
                        value={priced.quantity}
                        onChange={(event) =>
                          updateItem(id, {
                            quantity: event.currentTarget.value,
                          })
                        }
                        aria-invalid={Boolean(errors[quantityField])}
                        aria-describedby={
                          errors[quantityField]
                            ? `${quantityErrorId} ${priceHintId}`
                            : priceHintId
                        }
                      />
                      <select
                        name={`itemUnit-${id}`}
                        aria-label={`واحد مقدار کالای ${number}`}
                        value={unit}
                        onChange={(event) => {
                          const val = event.currentTarget.value;
                          if (isQuoteUnit(val)) {
                            updateItem(id, {
                              unit: val,
                              pieceOptionKey: "",
                            });
                          }
                        }}
                      >
                        {quoteUnits
                          .filter(
                            (u) => !hidePieceUnits || (u !== "شاخه" && u !== "عدد"),
                          )
                          .map((u) => (
                            <option key={u}>{u}</option>
                          ))}
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
                      name={`itemDimensions-${id}`}
                      placeholder="مثلاً میلگرد A3 سایز ۱۶"
                      value={dimensions}
                      onChange={(event) =>
                        updateItem(id, {
                          dimensions: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  {requiresRebar && isPiece ? (
                    <label className="quote-item-rebar-size">
                      قطر میلگرد برای محاسبه وزن (میلی‌متر)
                      <input
                        name={`itemRebarDiameter-${id}`}
                        type="number"
                        min="4"
                        step="0.5"
                        inputMode="decimal"
                        placeholder="مثلاً ۸"
                        value={rebarDiameterMm}
                        onChange={(event) =>
                          updateItem(id, {
                            rebarDiameterMm: event.currentTarget.value,
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {pieceOptions.length > 0 && isPiece ? (
                    <label className="quote-item-rebar-size">
                      انتخاب دقیق از فهرست قیمت سایت
                      <select
                        name={`itemPieceOption-${id}`}
                        value={pieceOptionKey}
                        onChange={(event) =>
                          updateItem(id, {
                            pieceOptionKey: event.currentTarget.value,
                          })
                        }
                      >
                        <option value="">انتخاب کنید</option>
                        {pieceOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </div>
                <div className="quote-item-price" id={priceHintId}>
                  <ItemPriceHint
                    priced={priced}
                    loading={!evaluator && !priceLoadError}
                    loadError={priceLoadError}
                  />
                </div>
              </fieldset>
            );
          })}
        </div>
        <button
          className="add-quote-item"
          type="button"
          onClick={addItem}
          disabled={items.length >= MAX_QUOTE_ITEMS}
        >
          + افزودن کالای جدید
        </button>
      </section>
      <section className="quote-price-summary" aria-live="polite">
        <span>جمع تقریبی پیش‌فاکتور</span>
        <strong>
          {totals.hasAnyPriced
            ? formatToman(totals.totalToman)
            : "هنوز قابل محاسبه نیست"}
        </strong>
        <p>
          {totals.hasAnyPriced
            ? `جمع ${totals.pricedItemCount.toLocaleString("fa-IR")} از ${items.length.toLocaleString("fa-IR")} کالا محاسبه شده است. `
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
      ) : null}
    </form>
  );
}
