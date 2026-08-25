import assert from "node:assert/strict";
import test from "node:test";
import { isMarketPriceDataStale } from "../app/use-market-prices.ts";

const NOW = new Date("2026-08-05T12:00:00.000Z").getTime();

const item = (updatedAt) => ({
  id: "gold",
  label: "طلا",
  unit: "تومان",
  price: 1,
  status: "same",
  percent: 0,
  updatedAt,
});

const minutesAgo = (minutes) =>
  new Date(NOW - minutes * 60 * 1000).toISOString();

test("fresh fetchedAt with all fresh item timestamps is not stale", () => {
  const data = {
    fetchedAt: minutesAgo(1),
    items: [item(minutesAgo(1)), item(minutesAgo(2))],
  };
  assert.equal(isMarketPriceDataStale(data, NOW), false);
});

test("fresh fetchedAt with one stale item is stale", () => {
  const data = {
    fetchedAt: minutesAgo(1),
    items: [item(minutesAgo(1)), item(minutesAgo(20))],
  };
  assert.equal(isMarketPriceDataStale(data, NOW), true);
});

test("missing or invalid item timestamp is stale", () => {
  const missing = {
    fetchedAt: minutesAgo(1),
    items: [item(minutesAgo(1)), item(undefined)],
  };
  assert.equal(isMarketPriceDataStale(missing, NOW), true);

  const invalid = {
    fetchedAt: minutesAgo(1),
    items: [item(minutesAgo(1)), item("not-a-date")],
  };
  assert.equal(isMarketPriceDataStale(invalid, NOW), true);
});

test("old fetchedAt is stale regardless of item timestamps", () => {
  const data = {
    fetchedAt: minutesAgo(20),
    items: [item(minutesAgo(1)), item(minutesAgo(2))],
  };
  assert.equal(isMarketPriceDataStale(data, NOW), true);
});

test("an aged fallback payload is stale", () => {
  const data = {
    fetchedAt: minutesAgo(180),
    items: [item(minutesAgo(180)), item(minutesAgo(185))],
  };
  assert.equal(isMarketPriceDataStale(data, NOW), true);
});
