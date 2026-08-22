---
name: design-direction
description: Redirect an existing site that is competent but visually anonymous — the "it's not broken, it's just ugly / forgettable / generic" problem. Diagnoses why the page has no identity, forces three mutually exclusive art directions sourced from the subject's own material world, picks one by rendered tournament rather than by description, and rolls it out across a large existing codebase. Use this whenever the user says a site looks ugly, bland, generic, templated, boring, "like every other site", "AI-made", or asks to make it more beautiful, more striking, or more memorable — including when they only give one small example of what bothers them. Also use when previous design passes produced changes that were correct but did not make the page feel any different. Do NOT use for finding layout defects (use design-adversary) or for designing a page from scratch (use frontend-design).
---

# Design Direction

Ugly is rarely a defect count. A page can pass every spacing, contrast, and alignment
check and still be dead on arrival. When someone says a site is ugly and cannot point to
a specific broken thing, the diagnosis is almost always one of two conditions:

1. **No commitment.** The page is the average of every page in its category. Nothing on it
   could be wrong, because nothing on it was chosen.
2. **No range.** Everything is medium — medium size, medium weight, medium density,
   medium saturation. Composition needs a loudest thing and a quietest thing.

Both are fixable, and neither is fixed by iterating on the current design. Iterating on an
average moves it to a different average. This skill is a redirection, not a polish pass.

## Why agents fail at this specifically

When asked to "make it more beautiful", a model returns the centre of its training
distribution — which is the same place the current design already sits. That is why
successive design passes feel like motion without travel.

The counter-move is forced divergence: name the default before designing, then forbid it.
Everything below is built around that.

## Phase 1 — Diagnose the anonymity

Do not list defects. Answer these, in writing, before proposing anything.

**The logo test.** Cover the logo and the copy. Could this page belong to a different
company in a different country in a different industry? If yes, name three industries it
could pass for. That list is the size of the problem.

**Name the current language and its source.** Every design speaks a borrowed language.
Identify this one precisely — not "modern and clean" but e.g. "2019 SaaS dashboard: dark
neutral field, elevated white cards, one warm accent, 12px radius, soft shadow." Say where
it came from. A language you cannot name is one you cannot leave.

**Measure the range.**

```bash
node scripts/range.mjs https://example.com --accent=#YOURHEX --channel=chrome
```

This reports display-to-body type ratio, weight spread, surface vocabulary, accent share,
and an ink-density map of the page in 24 bands. Flat pages show a density map with no peaks
and no valleys, a type ratio under 3×, and two weights. Those numbers are the objective
form of "everything is medium."

**Find the unexploited material.** List ten concrete artifacts from the subject's actual
world — objects, documents, instruments, markings, vernacular. Not metaphors: things a
person in that industry touches. This list is where a non-generic direction comes from, and
skipping it is why generic directions happen. A steel trading business, for example, has
mill certificates, heat numbers, bundle tags, grade colour-coding painted on bar ends,
rolling marks embossed on the web of a beam, engineering section tables, caliper jaws,
weighbridge tickets. None of that is on the page. It is all more specific than a card.

## Phase 2 — Name the default, then ban it

Write out, in three sentences, the design you would produce if you were not thinking hard.
Then treat it as forbidden.

Current AI-design clusters, all of which count as defaults rather than choices: warm cream
field with high-contrast serif and terracotta accent; near-black field with a single bright
accent; broadsheet layout with hairline rules and zero radius. Elevated cards on a neutral
field with one accent colour is a fourth. If the brief explicitly asks for one of these,
the brief wins — otherwise spend the freedom elsewhere.

Also ban, for this project specifically, the exact language named in Phase 1. The point of
naming it was to make it unavailable.

## Phase 3 — Three directions that could each be wrong

Produce exactly three. Each needs:

- **A thesis in one sentence, stated as a claim that could be argued against.** "Trading
  steel is reading a spec sheet correctly, so the site should behave like an instrument,
  not a brochure" is a thesis. "Clean and trustworthy" is not.
- **Its source artifact** from the Phase 1 list, and what it contributes: structure,
  palette, texture, typographic voice, or motion behaviour.
- **A palette of 4–6 named hex values**, derived from the artifact rather than chosen for
  taste. Sample real colours from real objects where possible.
- **A type pairing** with roles: display, body, and a data/utility face. For RTL Persian,
  pick faces with genuine display weight range and real tabular numerals — most Persian
  webfonts have neither, and that constraint should drive the pairing.
- **A signature element**: the one thing the page is remembered by.
- **Its failure mode.** How this direction goes wrong if executed badly.

The three must fail in *different* ways. If all three fail by being too busy, they are one
direction in three costumes. Force separation: make one austere, one dense, one atmospheric,
or find another axis that genuinely splits them.

## Phase 4 — Tournament on renders, not descriptions

Descriptions all sound good. Renders do not.

Pick the single most content-heavy real section of the site — for a data site, the one
carrying the numbers people came for. Build that one section three times, once per
direction, with real content, at real dimensions. Screenshot each.

Then compare in pairs, looking at the images, and rule with a reason each time. Judge on:

- Which one would you recognise from across a room?
- Which one survives being reduced to 20% and squinted at? (Composition either has a shape
  or it is a stack of grey slabs.)
- Which one still looks intentional in the ugliest state — longest string, empty state,
  error state, worst screen width?
- Which one is hardest for a competitor to copy in an afternoon?

Discard two. Do not merge them; merging three directions produces the average, which is
where this started.

## Phase 5 — Widen the range

With the direction chosen, deliberately push the axes the meter showed as flat. Targets,
adjusted to the direction:

| Axis | Flat | Alive |
|---|---|---|
| Type ratio | display ≤ 3× body | 4–8×, with the largest thing genuinely large |
| Weight | 2 weights | 3+, including one extreme |
| Density | uniform ink map | alternating dense and near-empty bands; rest before a climax |
| Colour | accent everywhere | accent scarce enough that its appearance means something |
| Surface | one card treatment repeated | a hierarchy of surfaces where elevation encodes importance |
| Detail | uniform at all zooms | rewards close inspection: hairlines, tabular figures, micro-labels |

Scarcity is the mechanism behind most of these. An accent used thirty times is a background
colour. Spend boldness in one place and keep everything around it quiet.

## Phase 6 — Roll out without losing the thesis

On a large existing site, apply the direction through shared primitives, not page by page —
tokens first, then the three or four components that account for most of the surface. Then:

- **Keep a kill list.** Every element the direction makes unnecessary gets deleted, not
  restyled. Redirections that only add end up as the old design wearing a new coat.
- **Re-run `range.mjs` and diff.** If the numbers did not move, the visual language did not
  either, regardless of how much CSS changed.
- **Re-check the logo test.** Cover the logo again. If the answer is still "any industry",
  the direction was stated but not executed.
- **Then run `design-adversary`** for defects. Order matters: fixing spacing inside a design
  that is about to be replaced is wasted work.

## Output

Phases 1–3 are a written proposal, not code. Present the three directions with their theses,
palettes, type pairings, signatures, and failure modes, and stop. Direction is the user's
decision — building all three fully before they have seen the theses wastes most of the work.
