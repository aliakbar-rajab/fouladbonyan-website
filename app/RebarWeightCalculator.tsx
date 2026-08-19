import { useMemo, useState } from "react";
import { calculateRebarWeight } from "./catalog-behavior.mjs";
import { formatCatalogNumber } from "./catalog-utils";

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

  const weight = useMemo(
    () => calculateRebarWeight(diameter, length, quantity),
    [diameter, length, quantity],
  );

  const quantityInvalid =
    quantity !== "" &&
    (!Number.isInteger(Number(quantity)) || Number(quantity) <= 0);

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
              min="1"
              step="0.1"
              value={diameter}
              onChange={(event) => setDiameter(event.target.value)}
            />
          </label>
          <label>
            طول هر شاخه (متر)
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={length}
              onChange={(event) => setLength(event.target.value)}
            />
          </label>
          <label>
            تعداد شاخه
            <input
              type="number"
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
        </div>
      ) : null}
    </section>
  );
}
