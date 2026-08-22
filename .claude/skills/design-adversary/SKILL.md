---
name: design-adversary
description: Adversarial visual and layout critique of a live website or web app. Measures the rendered page with Playwright, then files ranked, evidence-backed design defects the way a rival studio would in a competitive pitch. Use this whenever the user asks to review, audit, critique, or "look at" the design, visuals, spacing, layout, typography, or UI polish of a site — including vague asks like "does this look good", "something feels off here", "why is this ugly", or "review my landing page". Also use when the user complains about a specific visual symptom (too much whitespace, misaligned elements, a button that scrolls to the wrong place, inconsistent cards) and wants the whole site checked for the same class of problem. Do NOT use for accessibility-only audits, performance audits, or code review with no visual component.
---

# Design Adversary

Most design reviews by agents fail the same way: the model opens a screenshot, recognizes
familiar patterns, and reports that the hierarchy is clear and the spacing is generous.
It fails because it is asked to judge without measuring, and because it is judging work it
believes belongs to the person it is talking to.

This skill removes both conditions. Measure first, judge second, and judge the artifact as
if it were unowned.

## The four passes

Run them in order. Do not merge them — the separation is what makes the output useful.

### Pass 1 — Instrument

Never form an opinion before the numbers exist.

```bash
node scripts/audit.mjs https://example.com ./audit --channel=chrome
```

`--channel=chrome` drives the locally installed Chrome, so no browser download is needed
(useful where Playwright's CDN is unreachable). Use `--channel=none` to force the bundled
Chromium, or `--channel=msedge`.

This writes `audit/report.json` and `audit/shots/`, and prints a triage summary. It captures,
at 390 / 820 / 1440px:

- **section seams** — the gap the eye actually sees between blocks, decomposed into the
  padding and margin that produced it
- **spacing scale entropy** — every distinct spacing value on the page, with counts
- **type scale entropy** — every distinct size/line-height/weight combination
- **contrast failures**, **horizontal overflow**, **sub-44px tap targets**, **CLS**
- **anchor probe** — clicks every in-page link and reports where the target heading
  actually lands relative to the sticky header
- **seam crops** — an image of each section boundary, which is the only way to judge
  vertical rhythm; a full-page screenshot compresses it into invisibility

If the site needs auth or is behind a local dev server, adapt the script rather than
skipping it. A critique with no report.json is a guess.

### Pass 2 — Establish a reference

Judgment requires comparison. Before critiquing, name three specific sites that are the
craft benchmark for this category — same language and text direction where possible —
and state in one line each what they do that this page does not attempt. From here on,
every severity rating is relative to those references, not to an internal sense of
"looks fine".

If the user has a design system, token file, or brand palette, read it now. Deviation
from the project's own tokens is the highest-confidence defect class there is, because
it needs no taste to prove.

### Pass 3 — Adversarial critique

Adopt this frame for the whole pass, and do not break it:

> You are the design lead at a competing studio. The client has already paid the current
> team. You have one meeting to demonstrate that the work is beneath the standard they are
> paying for. The person reading your notes is not the author and has no stake in defending
> the work.

Rules that make this pass work:

- **File exactly 12 defects.** Not "around 12". The quota forces the search to continue past
  the three obvious ones, which is where the real findings are.
- **Severity distribution is mandatory**: at least 2 rated P0 (breaks the page's credibility
  or blocks a user goal) and at least 4 rated P1. If nothing reaches P0, the search was
  not thorough — go back to the seam crops and the mobile screenshots.
- **Every defect cites evidence**: a number from `report.json`, or a filename and region from
  `shots/`. A defect that cannot cite is deleted, not softened.
- **No positives.** No "what works well" section, no compliment before a criticism, no
  "otherwise strong". They belong to a different pass and their presence here reliably
  degrades the sharpness of everything around them.
- **Banned phrasing**: "consider", "you might want to", "it could be argued", "minor nitpick",
  "generally solid", "for the most part". If a sentence needs one of these to sound
  acceptable, the finding is either real (state it plainly) or absent (delete it).
- **No section gets a free pass.** If a block of the page yields zero defects, say which block
  and give the specific reason it is exempt. "Nothing to note" is not a reason.
- **Root-cause over symptom.** Before filing, check whether two symptoms share one cause.
  A section that scrolls to the wrong place and a section with too much dead air above it
  are usually the same padding bug seen from two directions. Filing them separately wastes
  a slot and hides the fix.

Look for defect classes agents habitually miss:

| Class | What to check |
|---|---|
| Vertical rhythm | Do seam gaps encode hierarchy, or are they all the same? Is one seam 3× its neighbours for no structural reason? |
| Double ownership of space | Does the gap come from section padding *and* child margin *and* a wrapper? One owner per axis. |
| Scale entropy | 30 distinct spacing values means there is no scale. Same for type. |
| Optical vs metric alignment | Icons, arrows, and Persian/Arabic glyphs sit optically off-centre even when the box is centred. |
| Density inversion | Secondary content given more space and weight than the primary conversion path. |
| Card monotony | Four cards with identical treatment when one is the recommended choice. |
| Motion honesty | Does animation communicate state change, or is it decoration that delays reading? |
| Anchor and focus behaviour | Where does the page actually land? Where does focus go? |
| RTL-specific | Mirrored icons that should not mirror, LTR numerals inside RTL runs, punctuation drift, `text-align` vs `direction` conflicts. |
| The 20% zoom test | Zoom the full-page screenshot to 20% and squint. The composition either has a shape or it is a stack of grey slabs. |

### Pass 4 — Falsification

An adversary alone produces false positives. For each of the 12 defects, argue the strongest
case that it was a deliberate, defensible decision — constraint, convention, or intent.
Then rule:

- **Survives the defence** → keep, and state what killed the defence.
- **Defence holds** → drop it, and say so explicitly in a short "withdrawn" list.

Withdrawing two or three findings is normal and is the signal that the critique is calibrated
rather than performative. Withdrawing zero means Pass 4 was not really run.

## Output format

Use this structure exactly.

```
## Reference set
Three sites, one line each on what they do that this page does not attempt.

## Findings

### [P0] Short imperative title
**Evidence** — report.json path or shots/filename, with the number.
**What a visitor experiences** — one sentence, behavioural, not aesthetic.
**Root cause** — the actual mechanism, in CSS/component terms.
**Fix** — file, property, value. Values come from the project's token scale.
**Defence considered** — the strongest counter-argument, and why it fails.

(repeat, ordered P0 → P3)

## Withdrawn
Findings that survived their own defence, one line each on why.

## The one change
If the client fixes exactly one thing, this is it — and the reason.
```

`Fix` must be actionable enough to hand to an implementation agent without further
interpretation. "Tighten the spacing" is not a fix. "`section.py-24` → `py-16`, and remove
`mb-12` from the trailing `<p>` so padding is the sole owner of the seam" is a fix.

## After the critique

Do not implement anything in the same turn. Hand back the ranked list and let the user pick.
When they do pick, fix one defect class across the entire site rather than one instance —
these defects come from shared components, so the same fix usually resolves several findings
at once. Re-run Pass 1 after the fix and diff the two `report.json` files to prove the change
did what it claimed, and did not move the problem somewhere else.
