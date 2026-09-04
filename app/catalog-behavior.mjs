import { parsePersianNumber } from "./persian-numbers.mjs";
import { normalizeCatalogTrend } from "./catalog-trend.mjs";

export function calculateRebarWeight(diameter, length, quantity) {
  const parsedDiameter = parsePersianNumber(diameter);
  const parsedLength = parsePersianNumber(length);
  const parsedQuantity = parsePersianNumber(quantity);
  if (
    parsedDiameter === null ||
    parsedLength === null ||
    parsedQuantity === null ||
    !Number.isInteger(parsedQuantity) ||
    parsedDiameter <= 0 ||
    parsedLength <= 0 ||
    parsedQuantity <= 0
  ) {
    return null;
  }
  return ((parsedDiameter ** 2) / 162) * parsedLength * parsedQuantity;
}

export function getTrendPresentation(status, percent) {
  const trend = normalizeCatalogTrend(status, percent);
  if (trend.status === "unverified") {
    return { direction: "نیازمند بررسی", symbol: "!", amount: 0 };
  }
  if (trend.status === "mixed") {
    return { direction: "نوسان ترکیبی", symbol: "↕", amount: 0 };
  }
  const amount = Math.abs(trend.percent);
  if (amount === 0) {
    return { direction: "بدون تغییر", symbol: "—", amount: 0 };
  }
  if (trend.status === "up") {
    return { direction: "افزایش", symbol: "↑", amount };
  }
  if (trend.status === "down") {
    return { direction: "کاهش", symbol: "↓", amount };
  }
  return { direction: "بدون تغییر", symbol: "—", amount: 0 };
}
