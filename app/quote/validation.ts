import { parsePersianNumber } from "../persian-numbers.mjs";
import type {
  QuoteValidationResult,
  RawQuoteContact,
  RawQuoteRequest,
} from "../quote-types";
import { quoteProductSupportsPieceUnits } from "../quote-types";
import {
  normalizePhone,
  validateFullName,
  validatePhone,
} from "../form-validation";
import { isPieceUnit, itemIndexLabel } from "./calculation";

export const DISCLAIMER_ERROR =
  "برای آماده‌سازی درخواست باید متن غیرقطعی‌بودن درخواست را تأیید کنید.";

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
    } else if (
      item.product &&
      isPieceUnit(item.unit) &&
      !quoteProductSupportsPieceUnits(item.product)
    ) {
      errors[`itemQuantity-${item.id}`] =
        `واحد ${item.unit} برای ${item.product} پشتیبانی نمی‌شود؛ واحد وزنی را انتخاب کنید.`;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
