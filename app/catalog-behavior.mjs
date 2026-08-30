import { parsePersianNumber } from "./persian-numbers.mjs";

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
  const amount = Math.abs(Number(percent) || 0);
  if (amount === 0) {
    return { direction: "بدون تغییر", symbol: "—", amount: 0 };
  }
  if (status === "up") {
    return { direction: "افزایش", symbol: "↑", amount };
  }
  if (status === "down") {
    return { direction: "کاهش", symbol: "↓", amount };
  }
  return { direction: "بدون تغییر", symbol: "—", amount: 0 };
}

export { categoryPricingState as getCategoryPricingState } from "./catalog-pricing.mjs";
