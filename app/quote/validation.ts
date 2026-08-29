import { parsePersianNumber } from "../persian-numbers.mjs";
import type {
  QuoteValidationResult,
  RawQuoteContact,
  RawQuoteRequest,
} from "../quote-types";
import { toAsciiDigits } from "../site-logic.mjs";
import { isPieceUnit, itemIndexLabel } from "./calculation";

export const DISCLAIMER_ERROR =
  "برای آماده‌سازی درخواست باید متن غیرقطعی‌بودن درخواست را تأیید کنید.";

const iranianPhonePattern = /^(?:\+98|0098|98|0)?(?:9\d{9}|21\d{8})$/;

export function normalizePhone(value: string): string {
  return toAsciiDigits(value ?? "").replace(/[\s()-]/g, "");
}

export function validateFullName(value: string): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "نام و نام خانوادگی را وارد کنید.";
  if (normalized.length < 3) return "نام واردشده باید حداقل ۳ حرف باشد.";
  return "";
}

export function validatePhone(value: string): string {
  const normalized = normalizePhone(value);
  if (!normalized) return "شماره تماس را وارد کنید.";
  if (!iranianPhonePattern.test(normalized)) {
    return "شماره تماس معتبر ایرانی وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.";
  }
  return "";
}

export function validateDestination(value: string): string {
  return (value ?? "").trim() ? "" : "شهر مقصد را وارد کنید.";
}

export function validateQuantity(
  quantityInput: string,
  unit: string,
  index: number = 0,
): string {
  const label = `مقدار تقریبی کالای ${itemIndexLabel(index)}`;
  if (!quantityInput || !quantityInput.trim()) {
    return `${label} را وارد کنید.`;
  }
  const numeric = parsePersianNumber(quantityInput);
  if (numeric === null || numeric <= 0) {
    return `${label} باید عددی بزرگ‌تر از صفر باشد.`;
  }
  if (isPieceUnit(unit) && !Number.isInteger(numeric)) {
    return `${label} برای واحد ${unit} باید عدد صحیح باشد.`;
  }
  return "";
}

export function normalizeQuoteContact(
  raw: Partial<RawQuoteContact> | null | undefined,
): RawQuoteContact {
  return {
    fullName: (raw?.fullName ?? "").trim(),
    phone: normalizePhone(raw?.phone ?? ""),
    destination: (raw?.destination ?? "").trim(),
    notes: (raw?.notes ?? "").trim(),
  };
}

export type FieldValidationOptions = {
  unit?: string;
  itemIndex?: number;
};

export function validateQuoteField(
  field: string,
  value: unknown,
  options?: FieldValidationOptions,
): string {
  const stringValue = typeof value === "string" ? value : String(value ?? "");
  const index = options?.itemIndex ?? 0;
  const unit = options?.unit ?? "تن";

  if (field === "fullName") {
    return validateFullName(stringValue);
  }
  if (field === "phone") {
    return validatePhone(stringValue);
  }
  if (field === "destination") {
    return validateDestination(stringValue);
  }
  if (field === "acceptDisclaimer") {
    return value ? "" : DISCLAIMER_ERROR;
  }
  if (field.startsWith("itemProduct-") || field === "product") {
    return stringValue.trim()
      ? ""
      : `نوع کالای ${itemIndexLabel(index)} را وارد کنید.`;
  }
  if (field.startsWith("itemQuantity-") || field === "quantity") {
    return validateQuantity(stringValue, unit, index);
  }
  return "";
}

export function validateQuoteRequestInput(
  input: RawQuoteRequest,
): QuoteValidationResult {
  const errors: Record<string, string> = {};

  const nameError = validateFullName(input.contact?.fullName ?? "");
  if (nameError) errors.fullName = nameError;

  const phoneError = validatePhone(input.contact?.phone ?? "");
  if (phoneError) errors.phone = phoneError;

  const destinationError = validateDestination(input.contact?.destination ?? "");
  if (destinationError) errors.destination = destinationError;

  if (!input.acceptDisclaimer) {
    errors.acceptDisclaimer = DISCLAIMER_ERROR;
  }

  for (const [index, item] of (input.items ?? []).entries()) {
    if (!item.product) {
      errors[`itemProduct-${item.id}`] = `نوع کالای ${itemIndexLabel(index)} را وارد کنید.`;
    }
    const quantityError = validateQuantity(
      item.quantity ?? "",
      item.unit ?? "تن",
      index,
    );
    if (quantityError) {
      errors[`itemQuantity-${item.id}`] = quantityError;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
