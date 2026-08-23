import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import React from "react";
import { setupDomEnv } from "./helpers/dom-env.mjs";

setupDomEnv({ url: "https://example.test/" });

const { act, cleanup, render, screen } = await import("@testing-library/react");
const { useCatalogData } = await import("../app/use-catalog-data.ts");

afterEach(cleanup);

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

function Probe({ load, itemKey }) {
  const state = useCatalogData(load, itemKey);
  return React.createElement("p", null, state.status);
}

function makeLoader(behavior) {
  const calls = [];
  const load = Object.assign(
    async (key) => {
      calls.push(key);
      const result = behavior(key);
      if (result instanceof Error) throw result;
      return result;
    },
    { getCached: () => undefined },
  );
  return { load, calls };
}

test("a failed load settles into an error state and does not retry itself", async () => {
  const { load, calls } = makeLoader(() => new Error("network down"));

  render(React.createElement(Probe, { load, itemKey: "rebar" }));
  await settle();

  assert.equal(screen.getByText("error").textContent, "error");
  assert.equal(calls.length, 1);

  // Regression guard: setLoaded({status:"error"}) is a new object every
  // time, and the effect used to depend on that object without a guard for
  // the error case, so it refired itself and re-fetched forever. Give the
  // effect system several more chances to loop if that guard regresses.
  await settle();
  await settle();
  await settle();

  assert.equal(
    calls.length,
    1,
    "load must not be called again automatically after settling into an error state",
  );
  assert.equal(screen.getByText("error").textContent, "error");
});

test("a later success for a different key is unaffected by a prior key's error", async () => {
  const { load, calls } = makeLoader((key) =>
    key === "a" ? new Error("fail a") : { key },
  );

  const { rerender } = render(
    React.createElement(Probe, { load, itemKey: "a" }),
  );
  await settle();
  assert.equal(screen.getByText("error").textContent, "error");

  rerender(React.createElement(Probe, { load, itemKey: "b" }));
  await settle();

  assert.equal(screen.getByText("ready").textContent, "ready");
  assert.deepEqual(calls, ["a", "b"]);

  // Switching back to the still-failing key retries it exactly once, not in
  // a loop.
  rerender(React.createElement(Probe, { load, itemKey: "a" }));
  await settle();
  await settle();

  assert.equal(screen.getByText("error").textContent, "error");
  assert.deepEqual(calls, ["a", "b", "a"]);
});
