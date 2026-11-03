import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CloseIcon, PhoneIcon } from "./icons";
import { siteConfig } from "./site-config";
import { formatPersianNumber } from "./persian-numbers.mjs";
import {
  FieldErrors,
  focusFirstError,
  setFieldError,
} from "./form-validation";
import {
  formatToman,
} from "./quote/calculation";
import {
  isQuoteUnit,
  quoteDisclaimer,
  type GeneratedQuote,
  type RawQuoteItem,
} from "./quote-types";
import { isQuoteProduct, quoteProductNames } from "./quote/products";
import { takeQuoteHandoff } from "./quote-handoff";
import { validateQuoteField } from "./quote/validation";
import type { QuoteItemEstimate } from "./quote/evaluator";
import { QuoteDocument } from "./QuoteDocument";
import { takeQuoteNumber } from "./quote/document-number";
import { ErrorMessage } from "./request-form-shared";
import { usePreparedRequest } from "./use-prepared-request";
import { useQuoteRequestEstimate } from "./use-quote-request-estimate";

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
 * What a line shows in its estimate column, and the one-line nudge under it
 * when the visitor still owes a field before it can be priced. Nothing is said
 * while a row is simply unfinished: an empty row reads "—", not a sentence.
 */
type LineEstimate =
  | { kind: "loading" }
  | { kind: "none"; hint?: string }
  | { kind: "priced"; total: number; rate?: string };

function lineEstimate(
  priced: QuoteItemEstimate,
  loading: boolean,
  loadError: boolean,
): LineEstimate {
  const { product, quantity, unit, approximateTotalToman, pieceOption } = priced;
  const byPiece = priced.isPieceUnit;

  if (loading) return { kind: "loading" };
  if (loadError || !product) return { kind: "none" };
  if (byPiece && priced.requiresRebarDiameter && !priced.rebarDiameterMm) {
    return {
      kind: "none",
      hint: `برای محاسبه قیمت بر اساس ${unit}، قطر میلگرد را وارد کنید.`,
    };
  }
  // `pieceOption` is resolved *from* `pieceOptionKey`, so the list is what says
  // whether a pick is still owed -- testing `pieceOption` never fires.
  if (byPiece && priced.pieceOptions.length > 0 && !priced.pieceOptionKey) {
    return {
      kind: "none",
      hint: "برای محاسبه قیمت، آیتم دقیق را از فهرست قیمت سایت انتخاب کنید.",
    };
  }
  if (!quantity.trim()) return { kind: "none" };
  if (approximateTotalToman === null) {
    return {
      kind: "none",
      hint: "برای مشاهده برآورد، مقدار معتبر بزرگ‌تر از صفر وارد کنید.",
    };
  }

  const rate = pieceOption
    ? `هر ${pieceOption.unit} ${formatToman(pieceOption.priceToman)}`
    : priced.unitPriceTomanPerKg
      ? `هر کیلوگرم ${formatToman(priced.unitPriceTomanPerKg)}`
      : undefined;
  return { kind: "priced", total: approximateTotalToman, rate };
}

function Amount({ value }: { value: number }) {
  return (
    <>
      {formatPersianNumber(value)}
      <small> تومان</small>
    </>
  );
}

const salesPhone = siteConfig.contact.phones[0];

export function QuoteRequestForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [items, setItems] = useState<RawQuoteItem[]>([createQuoteItem(1)]);
  const [generatedQuote, setGeneratedQuote] = useState<GeneratedQuote | null>(
    null,
  );
  const nextItemId = useRef(2);
  const prepared = usePreparedRequest();
  const {
    evaluator,
    isLoading: isPriceLoading,
    loadError: priceLoadError,
  } = useQuoteRequestEstimate();

  useEffect(() => {
    /*
     * Two prefill sources, in order. A price row hands its pick over in
     * sessionStorage now (quote-handoff.ts) so it stops minting one crawlable
     * `?product=&dimensions=` URL per row; the query string is still read
     * second so links already shared or bookmarked keep working. Both are
     * validated the same way -- the product must be a real option and the
     * dimensions are length-capped -- because neither is trusted input.
     */
    const handoff = takeQuoteHandoff();
    const params = new URLSearchParams(window.location.search);
    const requestedProduct = handoff?.product ?? params.get("product");
    const requestedDimensions = (
      handoff?.dimensions ??
      params.get("dimensions") ??
      ""
    ).slice(0, 240);
    const matchedProduct = isQuoteProduct(requestedProduct)
      ? requestedProduct
      : undefined;
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

  /*
   * Contact fields only. Every item field is already re-validated by
   * `updateItem`, which is the only place that knows the two things an item
   * message needs: the row's position (messages name it, "کالای ۲") and its
   * unit (a شاخه quantity must be a whole number, a تن quantity need not be).
   *
   * This handler runs on the form, so it fires *after* the item's own onChange
   * for the same event. Validating item fields here too meant re-deriving them
   * from nothing and always getting index 0 and تن: the correct message
   * `updateItem` had just written was overwritten a moment later by one that
   * named the wrong row, and a fractional شاخه quantity had its error cleared
   * -- aria-invalid and all -- while submit went on rejecting it.
   */
  const validateChangedField = (
    element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  ) => {
    const { name, value } = element;
    if (name.startsWith("item")) return;
    const isCheckbox =
      element instanceof HTMLInputElement && element.type === "checkbox";
    const fieldValue = isCheckbox ? element.checked : value;
    const errorMsg = validateQuoteField(name, fieldValue);
    setFieldError(setErrors, name, errorMsg);
  };

  const { items: pricedItems, totals } = useMemo(
    () => evaluator.estimateItems(items),
    [items, evaluator],
  );

  const clearDraft = () => {
    prepared.clear();
    setGeneratedQuote(null);
  };

  const updateItem = (itemId: number, patch: Partial<RawQuoteItem>) => {
    const index = items.findIndex((item) => item.id === itemId);
    if (index === -1) return;

    // Patched through the evaluator, which reconciles the fields pricing couples
    // together -- a product that cannot be sold by the piece takes the item's
    // شاخه unit down with it rather than leaving it stranded.
    const patched = evaluator.applyItemChange(items[index], patch);

    setItems(items.map((item, position) => (position === index ? patched : item)));

    if ("product" in patch) {
      setFieldError(
        setErrors,
        `itemProduct-${itemId}`,
        validateQuoteField("product", patched.product, { itemIndex: index }),
      );
    }
    // A product change can move the unit, so the quantity rule it is checked
    // against moves with it.
    if ("product" in patch || "quantity" in patch || "unit" in patch) {
      setFieldError(
        setErrors,
        `itemQuantity-${itemId}`,
        validateQuoteField("quantity", patched.quantity, {
          unit: patched.unit,
          itemIndex: index,
        }),
      );
    }
    clearDraft();
  };

  /*
   * Item error messages name the item by its position ("کالای ۲"), so adding or
   * removing a row makes the messages under it stale and they are dropped.
   * Contact errors are not renumbered by that, so they stay: clearing every
   * error made the visitor's outstanding name or phone problem disappear from
   * the page the moment they added a second product.
   */
  const dropItemErrors = () =>
    setErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([field]) => !field.startsWith("item")),
      ),
    );

  const addItem = () => {
    if (items.length >= MAX_QUOTE_ITEMS) return;
    const added = createQuoteItem(nextItemId.current++);
    setItems((current) => [...current, added]);
    dropItemErrors();
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
    dropItemErrors();
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

    const evaluation = evaluator.evaluateRequest({
      contact,
      items,
      acceptDisclaimer: form.get("acceptDisclaimer") === "on",
    });

    setErrors(evaluation.validation.errors);
    if (focusFirstError(event.currentTarget, evaluation.validation.errors)) {
      return;
    }

    prepared.prepare(evaluation.message);
    setGeneratedQuote({
      ...evaluation.document,
      number: takeQuoteNumber(evaluation.document.date),
    });
  };

  /*
   * Phones get a bar pinned to the bottom with the running total, so the
   * number stays in sight while the item list scrolls. It steps aside while
   * the summary it repeats is on screen, and once the document exists.
   */
  const summaryRef = useRef<HTMLElement>(null);
  const [summaryInView, setSummaryInView] = useState(false);
  useEffect(() => {
    const summary = summaryRef.current;
    if (!summary || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setSummaryInView(entry.isIntersecting),
      { threshold: 0.1 },
    );
    observer.observe(summary);
    return () => observer.disconnect();
  }, []);
  const dockHidden = summaryInView || generatedQuote !== null;

  const totalStatus = isPriceLoading
    ? "در حال دریافت قیمت‌های سایت…"
    : priceLoadError
      ? "دریافت قیمت تقریبی ممکن نشد؛ برای قیمت روز با واحد فروش تماس بگیرید."
      : totals.hasAnyPriced
        ? `${formatPersianNumber(totals.pricedItemCount)} از ${formatPersianNumber(items.length)} کالا محاسبه شد · تقریبی و غیرقطعی`
        : "با انتخاب کالا و واردکردن مقدار، برآورد اینجا نمایش داده می‌شود.";

  return (
    <form
      className="quote-sheet"
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
      {/*
        Its own box so the sticky summary is bounded by the item list: in the
        form itself it would ride down over the generated document.
      */}
      <div className="quote-workspace">
        <section className="quote-panel" aria-labelledby="quote-items-heading">
          <header className="quote-panel-head">
            <h2 id="quote-items-heading">
              <span className="quote-panel-index" aria-hidden="true">
                ۱
              </span>
              کالاها
            </h2>
            <span className="quote-panel-count">
              {formatPersianNumber(items.length)} قلم
            </span>
          </header>

          <div className="quote-lines">
            <div className="quote-lines-head" aria-hidden="true">
              <span>#</span>
              <span>نوع محصول</span>
              <span>ابعاد، گرید یا استاندارد</span>
              <span>مقدار</span>
              <span>برآورد</span>
            </div>
            {pricedItems.map((priced, index) => {
              const { product, unit, id, pieceOptionKey, rebarDiameterMm, dimensions } = priced;
              const number = formatPersianNumber(index + 1);
              const productField = `itemProduct-${id}`;
              const quantityField = `itemQuantity-${id}`;
              const productErrorId = `quote-product-${id}-error`;
              const quantityErrorId = `quote-quantity-${id}-error`;
              const priceHintId = `quote-price-${id}-hint`;
              const noteId = `quote-price-${id}-note`;

              const pieceOptions = priced.pieceOptions;
              const requiresRebar = priced.requiresRebarDiameter;
              const isPiece = priced.isPieceUnit;
              const estimate = lineEstimate(priced, isPriceLoading, priceLoadError);
              const hint = estimate.kind === "none" ? estimate.hint : undefined;
              const describedBy = [
                errors[quantityField] ? quantityErrorId : "",
                priceHintId,
                hint ? noteId : "",
              ]
                .filter(Boolean)
                .join(" ");
              const showRebar = requiresRebar && isPiece;
              const showPieceOptions = pieceOptions.length > 0 && isPiece;

              return (
                <fieldset className="quote-line" key={id}>
                  <legend className="sr-only">کالای {number}</legend>
                  <span className="quote-line-number" aria-hidden="true">
                    <span className="quote-line-word">کالای </span>
                    {number}
                  </span>
                  <label className="quote-field quote-line-product">
                    <span className="quote-field-label">نوع محصول</span>
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
                  <label className="quote-field quote-line-spec">
                    <span className="quote-field-label">ابعاد، گرید یا استاندارد</span>
                    <input
                      name={`itemDimensions-${id}`}
                      placeholder="مثلاً A3 سایز ۱۶"
                      value={dimensions}
                      onChange={(event) =>
                        updateItem(id, {
                          dimensions: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label className="quote-field quote-line-qty">
                    <span className="quote-field-label">مقدار تقریبی</span>
                    <span className="quote-qty-control">
                      <input
                        name={quantityField}
                        type="number"
                        min={isPiece ? "1" : "0.01"}
                        step={isPiece ? "1" : "any"}
                        inputMode={isPiece ? "numeric" : "decimal"}
                        placeholder="۰"
                        value={priced.quantity}
                        onChange={(event) =>
                          updateItem(id, {
                            quantity: event.currentTarget.value,
                          })
                        }
                        aria-invalid={Boolean(errors[quantityField])}
                        aria-describedby={describedBy}
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
                        {priced.availableUnits.map((u) => (
                          <option key={u}>{u}</option>
                        ))}
                      </select>
                    </span>
                    <ErrorMessage
                      id={quantityErrorId}
                      message={errors[quantityField]}
                    />
                  </label>
                  <div
                    className={`quote-line-price quote-line-price--${estimate.kind}`}
                    id={priceHintId}
                  >
                    <span className="quote-field-label">برآورد</span>
                    {estimate.kind === "priced" ? (
                      <>
                        <strong>
                          <Amount value={estimate.total} />
                        </strong>
                        {estimate.rate ? <span>{estimate.rate}</span> : null}
                      </>
                    ) : (
                      <strong>
                        <span aria-hidden="true">
                          {estimate.kind === "loading" ? "…" : "—"}
                        </span>
                        <span className="sr-only">هنوز محاسبه نشده</span>
                      </strong>
                    )}
                  </div>
                  {items.length > 1 ? (
                    <button
                      className="quote-line-remove"
                      type="button"
                      onClick={() => removeItem(id)}
                      aria-label={`حذف کالای ${number}`}
                      title="حذف این کالا"
                    >
                      <CloseIcon />
                    </button>
                  ) : null}
                  {showRebar || showPieceOptions ? (
                    <div className="quote-line-extra">
                      {showRebar ? (
                        <label className="quote-field">
                          <span>قطر میلگرد برای محاسبه وزن (میلی‌متر)</span>
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
                      {showPieceOptions ? (
                        <label className="quote-field">
                          <span>انتخاب دقیق از فهرست قیمت سایت</span>
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
                  ) : null}
                  {hint ? (
                    <p className="quote-line-hint" id={noteId}>
                      {hint}
                    </p>
                  ) : null}
                </fieldset>
              );
            })}
          </div>

          <button
            className="quote-add"
            type="button"
            onClick={addItem}
            disabled={items.length >= MAX_QUOTE_ITEMS}
          >
            {items.length >= MAX_QUOTE_ITEMS ? (
              `حداکثر ${formatPersianNumber(MAX_QUOTE_ITEMS)} کالا در یک پیش‌فاکتور`
            ) : (
              <>
                <span aria-hidden="true">+</span> افزودن کالای جدید
              </>
            )}
          </button>
        </section>

        <aside
          className="quote-summary"
          id="quote-summary"
          ref={summaryRef}
          aria-labelledby="quote-contact-heading"
        >
          <div className="quote-total">
            <span className="quote-total-label">جمع تقریبی پیش‌فاکتور</span>
            <strong
              className={totals.hasAnyPriced ? undefined : "quote-total-empty"}
              aria-live="polite"
            >
              {totals.hasAnyPriced ? <Amount value={totals.totalToman} /> : "—"}
            </strong>
            <p>{totalStatus}</p>
            <details className="quote-method">
              <summary>این برآورد چطور محاسبه می‌شود؟</summary>
              <p>
                از داده‌های قیمت فعلی سایت: برای تن و کیلوگرم مستقیم، برای
                شاخه/عدد میلگرد بر اساس وزن تقریبی هر شاخه با فرمول استاندارد و
                طول ۱۲ متر، و برای تیرآهن، لوله فولادی و مفتول و سیم بر اساس آیتم
                دقیق انتخابی از فهرست قیمت سایت. این مبلغ نهایی نیست و قیمت و
                موجودی را واحد فروش تأیید می‌کند.
              </p>
            </details>
          </div>

          <div className="quote-summary-body">
            <h2 id="quote-contact-heading">
              <span className="quote-panel-index" aria-hidden="true">
                ۲
              </span>
              اطلاعات تماس
            </h2>
            <div className="quote-contact">
              <label className="quote-field">
                <span className="quote-field-label">نام و نام خانوادگی</span>
                <input
                  name="fullName"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.fullName)}
                  aria-describedby={errors.fullName ? "quote-name-error" : undefined}
                />
                <ErrorMessage id="quote-name-error" message={errors.fullName} />
              </label>
              <label className="quote-field">
                <span className="quote-field-label">شماره تماس</span>
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
              <label className="quote-field">
                <span className="quote-field-label">شهر مقصد</span>
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
              {/* Closed, the textarea is still a form control: FormData reads it. */}
              <details className="quote-notes">
                <summary>افزودن توضیح تکمیلی (اختیاری)</summary>
                <label className="quote-field">
                  <span className="sr-only">توضیحات تکمیلی</span>
                  <textarea name="notes" rows={3} maxLength={1000} />
                </label>
              </details>
            </div>

            <div className="quote-consent">
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

            <button className="quote-submit" type="submit">
              آماده‌سازی پیش‌فاکتور
            </button>
            <p className="quote-privacy">
              اطلاعات این فرم فقط در مرورگر شما آماده می‌شود و به جایی ارسال
              نمی‌شود.
            </p>
            <a className="quote-call" href={salesPhone.href}>
              <PhoneIcon />
              سؤال دارید؟ واحد فروش
              <span dir="ltr">{salesPhone.label}</span>
            </a>
          </div>
        </aside>
      </div>

      {generatedQuote ? (
        <div className="quote-result">
          <QuoteDocument
            quote={generatedQuote}
            preparedText={prepared.preparedText}
            onCopy={prepared.copy}
            copyMessage={prepared.copyMessage}
          />
        </div>
      ) : null}

      <div
        className={dockHidden ? "quote-dock quote-dock--hidden" : "quote-dock"}
        role="group"
        aria-label="جمع و ادامه"
        aria-hidden={dockHidden}
        inert={dockHidden}
      >
        <a className="quote-dock-call" href={salesPhone.href} aria-label="تماس با واحد فروش">
          <PhoneIcon />
        </a>
        <span className="quote-dock-total">
          <small>جمع تقریبی</small>
          <strong>
            {totals.hasAnyPriced ? <Amount value={totals.totalToman} /> : "—"}
          </strong>
        </span>
        <a className="quote-dock-next" href="#quote-summary">
          ادامه
        </a>
      </div>
    </form>
  );
}
