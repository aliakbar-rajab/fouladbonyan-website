export const MAX_RELIABLE_TREND_PERCENT = 100;

const SOURCE_TREND_STATUSES = new Set(["up", "down", "same"]);

/** Keep suspect upstream comparisons visible as a data-quality state, not a claim. */
export function normalizeCatalogTrend(status, percent) {
  const numericPercent = Number(percent);
  if (
    !Number.isFinite(numericPercent) ||
    Math.abs(numericPercent) > MAX_RELIABLE_TREND_PERCENT ||
    (!SOURCE_TREND_STATUSES.has(status) &&
      status !== "unverified" &&
      status !== "mixed")
  ) {
    return {
      status: "unverified",
      percent: Number.isFinite(numericPercent) ? numericPercent : 0,
    };
  }

  if (status === "unverified") {
    return { status, percent: numericPercent };
  }
  if (status === "mixed") {
    return { status, percent: 0 };
  }

  return {
    status: numericPercent === 0 ? "same" : status,
    percent: numericPercent,
  };
}

/** Derive one honest overview trend from all categories in a product group. */
export function summarizeCatalogTrends(summaries) {
  const trends = (summaries ?? []).map((summary) =>
    normalizeCatalogTrend(summary?.status, summary?.percent),
  );
  if (!trends.length) return { status: "same", percent: 0 };
  if (trends.some((trend) => trend.status === "unverified")) {
    return { status: "unverified", percent: 0 };
  }

  const moving = trends.filter(
    (trend) =>
      (trend.status === "up" || trend.status === "down") &&
      Math.abs(trend.percent) > 0,
  );
  if (!moving.length) return { status: "same", percent: 0 };

  const directions = new Set(moving.map((trend) => trend.status));
  if (directions.size > 1) return { status: "mixed", percent: 0 };

  return {
    status: moving[0].status,
    percent:
      moving.reduce((sum, trend) => sum + Math.abs(trend.percent), 0) /
      moving.length,
  };
}

export function summarizeCatalogDates(summaries) {
  const dates = [
    ...new Set(
      (summaries ?? [])
        .map((summary) => String(summary?.date ?? "").trim())
        .filter(Boolean),
    ),
  ];
  if (!dates.length) return "امروز";
  return dates.length === 1 ? dates[0] : "به‌روزرسانی‌های متفاوت";
}
