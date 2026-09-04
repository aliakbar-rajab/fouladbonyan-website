import { useMemo, useState } from "react";
import { calculateRebarWeight } from "./catalog-behavior.mjs";
import { formatCatalogNumber } from "./catalog-utils";
import { parsePersianNumber } from "./persian-numbers.mjs";

/**
 * Rebar-only sidebar tool. It lives outside the shared catalog so the catalog
 * carries no product-specific markup: the rebar route passes it in as the
 * catalog's sidebar extra, every other route passes nothing.
 */
export function RebarWeightCalculator() {
  const [open, setOpen] = useState(false);
  const [diameter, setDiameter] = useState("16");
  const [length, setLength] = useState("12");
  const [quantity, setQuantity] = useState("1");

  const quantityNum = parsePersianNumber(quantity);
  const quantityInvalid =
    quantity !== "" &&
    (quantityNum === null || !Number.isInteger(quantityNum) || quantityNum <= 0);

  /*
   * Diameter and length get the same invalid treatment as quantity: a weight
   * computed from silent garbage (0.5 mm, 0 m) is worse than an error. The
   * diameter floor mirrors the input's own min="1" -- no real rebar is under
   * 1 mm. Empty stays valid while the field is being cleared mid-edit. An
   * invalid field suppresses the weight entirely instead of printing one the
   * inputs contradict.
   */
  const diameterNum = parsePersianNumber(diameter);
  const diameterInvalid =
    diameter !== "" && (diameterNum === null || diameterNum < 1);
  const lengthNum = parsePersianNumber(length);
  const lengthInvalid = length !== "" && (lengthNum === null || lengthNum <= 0);

  const weight = useMemo(
    () =>
      diameterInvalid || lengthInvalid || quantityInvalid
        ? null
        : calculateRebarWeight(diameter, length, quantity),
    [diameter, length, quantity, diameterInvalid, lengthInvalid, quantityInvalid],
  );

  return (
    <section className="calculator-card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="rebar-weight-calculator"
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">⚖</span>
        <span>
          <strong>محاسبه وزن میلگرد</strong>
          <small>بر اساس فرمول وزن استاندارد</small>
        </span>
        <b aria-hidden="true">{open ? "−" : "+"}</b>
      </button>
      {open ? (
        <div id="rebar-weight-calculator" className="calculator-fields">
          <label>
            قطر (میلی‌متر)
            <input
              type="number"
              inputMode="decimal"
              min="1"
              step="0.1"
              value={diameter}
              aria-invalid={diameterInvalid}
              aria-describedby={
                diameterInvalid ? "rebar-diameter-error" : undefined
              }
              onChange={(event) => setDiameter(event.target.value)}
            />
          </label>
          {diameterInvalid ? (
            <small id="rebar-diameter-error" role="alert">
              قطر باید حداقل ۱ میلی‌متر باشد.
            </small>
          ) : null}
          <label>
            طول هر شاخه (متر)
            <input
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              value={length}
              aria-invalid={lengthInvalid}
              aria-describedby={
                lengthInvalid ? "rebar-length-error" : undefined
              }
              onChange={(event) => setLength(event.target.value)}
            />
          </label>
          {lengthInvalid ? (
            <small id="rebar-length-error" role="alert">
              طول هر شاخه باید عددی بزرگ‌تر از صفر باشد.
            </small>
          ) : null}
          <label>
            تعداد شاخه
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={quantity}
              aria-invalid={quantityInvalid}
              aria-describedby={
                quantityInvalid ? "rebar-quantity-error" : undefined
              }
              onChange={(event) => setQuantity(event.target.value)}
            />
          </label>
          {quantityInvalid ? (
            <small id="rebar-quantity-error" role="alert">
              تعداد شاخه باید یک عدد صحیح مثبت باشد.
            </small>
          ) : null}
          <p>
            وزن تقریبی:
            <strong>
              {weight === null ? " — " : ` ${formatCatalogNumber(weight, 2)} `}
              کیلوگرم
            </strong>
          </p>
          <a href="/guide/rebar-weight-chart/" className="calculator-guide-link">
            مشاهده جدول کامل وزن میلگرد و فرمول محاسباتی ←
          </a>
        </div>
      ) : null}
    </section>
  );
}
