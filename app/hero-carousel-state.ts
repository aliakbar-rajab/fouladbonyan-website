/*
 * Which homepage hero slide is on screen, and which one is waiting to be.
 *
 * Only the first slide's photo is part of the initial load. The others are
 * invisible until they rotate in, so they are requested once the page has
 * finished loading -- they used to compete with the first slide (the LCP
 * image) for the first bytes. A slide only ever comes on screen once its photo
 * has decoded: if it is due before that (a slow connection, or a visitor
 * jumping straight to it), the carousel queues it and waits, and a photo that
 * fails to load is skipped rather than shown blank.
 */

export type SlideStatus = "pending" | "ready" | "failed";

export type CarouselState = {
  active: number;
  /** The slide waiting for its photo before it comes on screen. */
  queued: number | null;
  /** Slides whose photo was asked for ahead of the page load (a direct jump). */
  requested: boolean[];
  status: SlideStatus[];
};

export type CarouselAction =
  | { type: "show"; index: number }
  | { type: "advance" }
  | { type: "settled"; index: number; status: "ready" | "failed" }
  | { type: "cancelQueue" };

export function initialCarouselState(slideCount: number): CarouselState {
  return {
    active: 0,
    queued: null,
    requested: Array.from({ length: slideCount }, () => false),
    status: Array.from({ length: slideCount }, () => "pending"),
  };
}

/** The next slide after `from` whose photo has not failed, or null. */
function nextShowable(state: CarouselState, from: number) {
  const count = state.status.length;
  for (let step = 1; step < count; step += 1) {
    const index = (from + step) % count;
    if (state.status[index] !== "failed") return index;
  }
  return null;
}

function showOrQueue(state: CarouselState, index: number): CarouselState {
  if (index === state.active) return { ...state, queued: null };
  if (state.status[index] === "ready") {
    return { ...state, active: index, queued: null };
  }
  if (state.status[index] === "failed") return state;
  const requested = state.requested.slice();
  requested[index] = true;
  return { ...state, queued: index, requested };
}

export function carouselReducer(
  state: CarouselState,
  action: CarouselAction,
): CarouselState {
  switch (action.type) {
    case "show":
      return showOrQueue(state, action.index);
    case "advance": {
      const next = nextShowable(state, state.active);
      return next === null ? state : showOrQueue(state, next);
    }
    case "settled": {
      const status = state.status.slice();
      status[action.index] = action.status;
      const settled = { ...state, status };
      if (state.queued !== action.index) return settled;
      if (action.status === "ready") {
        return { ...settled, active: action.index, queued: null };
      }
      // The queued photo failed: move on to the one after it instead.
      const next = nextShowable(settled, action.index);
      const cleared = { ...settled, queued: null };
      return next === null || next === state.active
        ? cleared
        : showOrQueue(cleared, next);
    }
    case "cancelQueue":
      return state.queued === null ? state : { ...state, queued: null };
  }
}
