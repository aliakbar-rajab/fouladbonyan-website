import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { setupDomEnv } from "./helpers/dom-env.mjs";

setupDomEnv({ url: "https://example.test/" });

const { act, cleanup, render, screen } = await import("@testing-library/react");
const { useMarketPrices } = await import("../app/use-market-prices.ts");

afterEach(cleanup);

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function validMarketPayload() {
  const nowIso = new Date().toISOString();
  return {
    fetchedAt: nowIso,
    sourceName: "tgju.org",
    sourceUrl: "https://www.tgju.org/",
    items: [
      {
        id: "gold",
        label: "طلای ۱۸ عیار",
        unit: "تومان / گرم",
        price: 4_500_000,
        status: "up",
        percent: 1.2,
        updatedAt: nowIso,
      },
      {
        id: "usd",
        label: "دلار آمریکا",
        unit: "تومان",
        price: 60_000,
        status: "down",
        percent: 0.5,
        updatedAt: nowIso,
      },
      {
        id: "tether",
        label: "تتر",
        unit: "تومان",
        price: 60_100,
        status: "same",
        percent: 0,
        updatedAt: nowIso,
      },
      {
        id: "eur",
        label: "یورو",
        unit: "تومان",
        price: 65_000,
        status: "up",
        percent: 0.3,
        updatedAt: nowIso,
      },
    ],
  };
}

function Probe() {
  const state = useMarketPrices();
  const label =
    state.status === "ready"
      ? `ready:${state.isStale ? "stale" : "fresh"}:${state.data.items.length}`
      : state.status;
  return React.createElement(
    "div",
    null,
    React.createElement("p", { "data-testid": "state" }, label),
    React.createElement("button", { type: "button", onClick: state.retry }, "retry"),
  );
}

test("useMarketPrices accepts a valid payload and transitions to ready", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json(validMarketPayload()));

  render(React.createElement(Probe));
  await settle();

  assert.equal(screen.getByTestId("state").textContent, "ready:fresh:4");
});

test("useMarketPrices rejects malformed responses that would crash the widget", async (t) => {
  const malformedPayloads = [
    // Missing item.price & item.updatedAt (previously passed the weak guard)
    { fetchedAt: new Date().toISOString(), items: [{ id: "gold" }] },
    // Surplus 5th item violating the 4-instrument contract
    (() => {
      const payload = validMarketPayload();
      payload.items.push({ ...payload.items[0], id: "extra" });
      return payload;
    })(),
    // Invalid fetchedAt timestamp
    (() => {
      const payload = validMarketPayload();
      payload.fetchedAt = "not-a-date";
      return payload;
    })(),
  ];

  for (const badPayload of malformedPayloads) {
    const mock = t.mock.method(globalThis, "fetch", async () =>
      Response.json(badPayload),
    );
    render(React.createElement(Probe));
    await settle();
    assert.equal(screen.getByTestId("state").textContent, "unavailable");
    cleanup();
    mock.mock.restore();
  }
});

test("useMarketPrices keeps last-good data marked stale when a retry receives malformed data, and recovers on retry", async (t) => {
  const responses = [
    () => Response.json(validMarketPayload()),
    () => Response.json({ fetchedAt: new Date().toISOString(), items: [{ id: "gold" }] }),
    () => Response.json(validMarketPayload()),
  ];
  let index = 0;
  t.mock.method(globalThis, "fetch", async () => responses[index++]());

  render(React.createElement(Probe));
  await settle();
  assert.equal(screen.getByTestId("state").textContent, "ready:fresh:4");

  await act(async () => {
    screen.getByText("retry").click();
  });
  await settle();
  assert.equal(screen.getByTestId("state").textContent, "ready:stale:4");

  await act(async () => {
    screen.getByText("retry").click();
  });
  await settle();
  assert.equal(screen.getByTestId("state").textContent, "ready:fresh:4");
});
