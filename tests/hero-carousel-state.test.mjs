import assert from "node:assert/strict";
import test from "node:test";
import {
  carouselReducer,
  initialCarouselState,
} from "../app/hero-carousel-state.ts";

const run = (actions, state = initialCarouselState(3)) =>
  actions.reduce(carouselReducer, state);

test("a due slide whose photo has not loaded waits instead of rotating in", () => {
  const state = run([{ type: "advance" }]);
  assert.equal(state.active, 0, "the first slide stays on screen");
  assert.equal(state.queued, 1, "the next slide waits for its photo");
  assert.equal(state.requested[1], true, "and its photo is asked for now");
});

test("a waiting slide comes on screen the moment its photo is ready", () => {
  const state = run([
    { type: "advance" },
    { type: "settled", index: 1, status: "ready" },
  ]);
  assert.equal(state.active, 1);
  assert.equal(state.queued, null);
});

test("a slide whose photo is already ready rotates in straight away", () => {
  const state = run([
    { type: "settled", index: 1, status: "ready" },
    { type: "advance" },
  ]);
  assert.equal(state.active, 1);
  assert.equal(state.queued, null);
});

test("a photo that settles for a slide nobody is waiting on changes nothing on screen", () => {
  const state = run([{ type: "settled", index: 2, status: "ready" }]);
  assert.equal(state.active, 0);
  assert.equal(state.status[2], "ready");
});

test("a broken photo is skipped, never shown blank", () => {
  const skippedWhileWaiting = run([
    { type: "settled", index: 2, status: "ready" },
    { type: "advance" },
    { type: "settled", index: 1, status: "failed" },
  ]);
  assert.equal(skippedWhileWaiting.active, 2, "the slide after the broken one comes in");

  const skippedUpFront = run([
    { type: "settled", index: 1, status: "failed" },
    { type: "advance" },
  ]);
  assert.equal(skippedUpFront.active, 0);
  assert.equal(skippedUpFront.queued, 2, "the broken slide is passed over");
});

test("jumping to a slide also waits for its photo", () => {
  const state = run([{ type: "show", index: 2 }]);
  assert.equal(state.active, 0);
  assert.equal(state.queued, 2);
  assert.equal(state.requested[2], true);
});

test("pausing drops a slide that was waiting to rotate in", () => {
  const state = run([
    { type: "advance" },
    { type: "cancelQueue" },
    { type: "settled", index: 1, status: "ready" },
  ]);
  assert.equal(state.active, 0, "the photo arriving later does not move the carousel");
  assert.equal(state.queued, null);
});

test("the carousel wraps from the last slide back to the first", () => {
  const state = run([
    { type: "settled", index: 0, status: "ready" },
    { type: "settled", index: 1, status: "ready" },
    { type: "settled", index: 2, status: "ready" },
    { type: "advance" },
    { type: "advance" },
    { type: "advance" },
  ]);
  assert.equal(state.active, 0);
});
