import type { Dispatch, SetStateAction } from "react";
import { toAsciiDigits } from "./persian-numbers.mjs";

export type FieldErrors = Record<string, string>;

/**
 * Re-validate one field, but only once it already carries an entry: a field the
 * visitor has not submitted yet must not sprout an error while they type in it.
 */
export function setFieldError(
  setErrors: Dispatch<SetStateAction<FieldErrors>>,
  field: string,
  message: string,
) {
  setErrors((current) =>
    field in current ? { ...current, [field]: message } : current,
  );
}

/**
 * Move focus to the first field that failed, so the visitor lands on the
 * problem instead of hunting for it. Returns true when the form has errors.
 */
export function focusFirstError(
  form: HTMLFormElement,
  errors: FieldErrors,
): boolean {
  const firstErrorField = Object.entries(errors).find(([, message]) =>
    Boolean(message),
  )?.[0];
  if (!firstErrorField) return false;

  const firstInvalid = form.elements.namedItem(firstErrorField);
  if (firstInvalid instanceof HTMLElement) firstInvalid.focus();
  return true;
}

const iranianPhonePattern = /^(?:\+98|0098|98|0)?(?:9\d{9}|21\d{8})$/;

export function normalizePhone(value: string) {
  return toAsciiDigits(value).replace(/[\s()-]/g, "");
}

export function validateFullName(value: string) {
  const normalized = value.trim();
  if (!normalized) return "نام و نام خانوادگی را وارد کنید.";
  if (normalized.length < 3) return "نام واردشده باید حداقل ۳ حرف باشد.";
  return "";
}

export function validatePhone(value: string) {
  const normalized = normalizePhone(value);
  if (!normalized) return "شماره تماس را وارد کنید.";
  if (!iranianPhonePattern.test(normalized)) {
    return "شماره تماس معتبر ایرانی وارد کنید؛ مانند ۰۹۱۲۱۲۳۴۵۶۷.";
  }
  return "";
}
export function validateRequired(value: string, label: string) {
  return value.trim() ? "" : `${label} را وارد کنید.`;
}

export function validateMinimumText(
  value: string,
  label: string,
  minimum: number,
) {
  const requiredError = validateRequired(value, label);
  if (requiredError) return requiredError;
  if (value.trim().length < minimum) {
    return `${label} باید حداقل ${minimum.toLocaleString("fa-IR")} حرف باشد.`;
  }
  return "";
}
