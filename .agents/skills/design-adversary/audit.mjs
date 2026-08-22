#!/usr/bin/env node
/**
 * audit.mjs — deterministic visual evidence collector.
 *
 * Usage:
 *   node audit.mjs <url> [outDir] [--channel=chrome] [--wait=1500]
 *
 * Produces:
 *   <outDir>/report.json     structured measurements
 *   <outDir>/shots/          full-page shots, per-section shots, section "seam" crops
 *
 * The point of this script is to remove eyeballing from the loop. Every claim in the
 * critique must trace back to a number in report.json or a pixel in shots/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args[0];
const outDir = path.resolve(args.find((a, i) => i > 0 && !a.startsWith('--')) || 'audit');
const channel = (args.find(a => a.startsWith('--channel=')) || '--channel=chrome').split('=')[1];
const settle = Number((args.find(a => a.startsWith('--wait=')) || '--wait=1500').split('=')[1]);

if (!url) {
  console.error('usage: node audit.mjs <url> [outDir] [--channel=chrome|msedge|none] [--wait=ms]');
  process.exit(1);
}

const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844, dsf: 2 },
  { name: 'tablet', width: 820, height: 1180, dsf: 2 },
  { name: 'desktop', width: 1440, height: 900, dsf: 1 },
];

fs.mkdirSync(path.join(outDir, 'shots'), { recursive: true });

/* ------------------------------------------------------------------ */
/* in-page collectors                                                  */
/* ------------------------------------------------------------------ */

const COLLECT = () => {
  const docTop = el => {
    const r = el.getBoundingClientRect();
    return { top: r.top + scrollY, bottom: r.bottom + scrollY, left: r.left, right: r.right, w: r.width, h: r.height };
  };
  const px = v => Math.round(parseFloat(v) || 0);

  /* ---- section rhythm ------------------------------------------- */
  const root = document.querySelector('main') || document.body;
  const blocks = [...root.children].filter(el => {
    const r = el.getBoundingClientRect();
    return r.height > 40 && getComputedStyle(el).display !== 'none';
  });

  const sections = blocks.map((el, i) => {
    const cs = getComputedStyle(el);
    const box = docTop(el);
    const heading = el.querySelector('h1,h2,h3');
    return {
      i,
      tag: el.tagName.toLowerCase(),
      id: el.id || null,
      cls: (el.className && String(el.className).slice(0, 80)) || null,
      label: (heading?.textContent || el.textContent || '').trim().slice(0, 40),
      box,
      padTop: px(cs.paddingTop),
      padBottom: px(cs.paddingBottom),
      marTop: px(cs.marginTop),
      marBottom: px(cs.marginBottom),
      headingOffsetInSection: heading ? Math.round(docTop(heading).top - box.top) : null,
      // dead space = distance from section top to the first thing that renders ink
      firstInkOffset: (() => {
        let best = Infinity;
        for (const n of el.querySelectorAll('*')) {
          const r = n.getBoundingClientRect();
          if (r.height < 2 || r.width < 2) continue;
          const s = getComputedStyle(n);
          const hasInk = (n.textContent || '').trim().length > 0 || s.backgroundImage !== 'none' ||
            n.tagName === 'IMG' || n.tagName === 'SVG' || n.tagName === 'CANVAS';
          if (hasInk) best = Math.min(best, r.top + scrollY - el.getBoundingClientRect().top - scrollY);
        }
        return Number.isFinite(best) ? Math.round(best) : null;
      })(),
    };
  });

  const gaps = [];
  for (let i = 0; i < sections.length - 1; i++) {
    const a = sections[i], b = sections[i + 1];
    gaps.push({
      between: [a.label || a.tag + '#' + i, b.label || b.tag + '#' + (i + 1)],
      indices: [i, i + 1],
      boxGap: Math.round(b.box.top - a.box.bottom),          // margin collapse result
      inkGap: Math.round(
        (b.box.top + (b.firstInkOffset ?? b.padTop)) -
        (a.box.bottom - a.padBottom)
      ),                                                      // what the eye actually sees
      contributors: { aPadBottom: a.padBottom, aMarBottom: a.marBottom, bMarTop: b.marTop, bPadTop: b.padTop },
    });
  }

  /* ---- spacing scale conformance --------------------------------- */
  const spacing = {};
  const nodes = [...document.querySelectorAll('body *')].slice(0, 4000);
  for (const n of nodes) {
    const cs = getComputedStyle(n);
    for (const p of ['marginTop', 'marginBottom', 'paddingTop', 'paddingBottom', 'gap', 'rowGap']) {
      const v = px(cs[p]);
      if (v > 0) spacing[v] = (spacing[v] || 0) + 1;
    }
  }

  /* ---- type inventory -------------------------------------------- */
  const type = {};
  for (const n of nodes) {
    if (!n.childNodes.length) continue;
    const hasText = [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim());
    if (!hasText) continue;
    const cs = getComputedStyle(n);
    const key = `${px(cs.fontSize)}/${px(cs.lineHeight)}/${cs.fontWeight}/${cs.letterSpacing}`;
    type[key] = (type[key] || 0) + 1;
  }

  /* ---- contrast --------------------------------------------------- */
  const parse = c => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b, a = 1] = m.map(Number);
    return { r, g, b, a };
  };
  const lum = ({ r, g, b }) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const effBg = el => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.5) return c;
      n = n.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const contrast = [];
  for (const n of nodes) {
    const txt = [...n.childNodes].filter(c => c.nodeType === 3).map(c => c.textContent.trim()).join('');
    if (txt.length < 2) continue;
    const cs = getComputedStyle(n);
    const fg = parse(cs.color), bg = effBg(n);
    if (!fg) continue;
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = px(cs.fontSize), weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (ratio < need) {
      contrast.push({
        text: txt.slice(0, 45), ratio: Number(ratio.toFixed(2)), need,
        fontSize: size, color: cs.color, on: `rgb(${bg.r},${bg.g},${bg.b})`,
        sel: n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).trim().split(/\s+/)[0] : ''),
      });
    }
  }

  /* ---- overflow & tap targets ------------------------------------ */
  const vw = document.documentElement.clientWidth;
  const overflow = {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: vw,
    offenders: nodes.filter(n => {
      const r = n.getBoundingClientRect();
      return r.width > 0 && (r.right > vw + 1 || r.left < -1);
    }).slice(0, 15).map(n => ({
      sel: n.tagName.toLowerCase() + (n.className ? '.' + String(n.className).trim().split(/\s+/)[0] : ''),
      right: Math.round(n.getBoundingClientRect().right), left: Math.round(n.getBoundingClientRect().left),
    })),
  };

  const tapTargets = [...document.querySelectorAll('a,button,[role="button"],input,select,summary')]
    .map(n => ({ n, r: n.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && (r.width < 44 || r.height < 44))
    .slice(0, 25)
    .map(({ n, r }) => ({
      text: (n.textContent || n.getAttribute('aria-label') || '').trim().slice(0, 30),
      w: Math.round(r.width), h: Math.round(r.height),
    }));

  /* ---- anchors ----------------------------------------------------- */
  const anchors = [...document.querySelectorAll('a[href^="#"]')]
    .map(a => a.getAttribute('href'))
    .filter(h => h && h.length > 1 && document.querySelector(h));

  const stickyHeader = (() => {
    const h = document.querySelector('header') || document.querySelector('[class*="header"]');
    if (!h) return null;
    const cs = getComputedStyle(h);
    return { position: cs.position, height: Math.round(h.getBoundingClientRect().height) };
  })();

  return {
    docHeight: document.documentElement.scrollHeight,
    sections, gaps, spacing, type, contrast, overflow, tapTargets, anchors, stickyHeader,
    imagesWithoutDims: [...document.images].filter(i => !i.getAttribute('width') || !i.getAttribute('height'))
      .slice(0, 20).map(i => i.currentSrc?.split('/').pop() || i.src),
  };
};

/* ------------------------------------------------------------------ */

const run = async () => {
  let browser;
  try {
    browser = await chromium.launch(channel === 'none' ? {} : { channel });
  } catch (e) {
    console.error(`could not launch channel "${channel}" (${e.message}); falling back to bundled chromium`);
    browser = await chromium.launch();
  }

  const report = { url, capturedAt: new Date().toISOString(), viewports: {} };

  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
    });
    const page = await ctx.newPage();

    const shifts = [];
    await page.addInitScript(() => {
      window.__cls = 0;
      new PerformanceObserver(l => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(settle);
    // force lazy content to resolve so measurements reflect the settled page
    await page.evaluate(async () => {
      const step = innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
      }
      scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
    });

    const data = await page.evaluate(COLLECT);
    data.cls = Number((await page.evaluate(() => window.__cls || 0)).toFixed(4));

    /* anchor probe — the "button scrolls to the wrong place" test */
    data.anchorProbe = [];
    for (const href of data.anchors.slice(0, 12)) {
      try {
        await page.evaluate(() => scrollTo(0, 0));
        await page.waitForTimeout(200);
        await page.locator(`a[href="${href}"]`).first().click({ timeout: 4000 });
        await page.waitForTimeout(1400);
        const res = await page.evaluate(sel => {
          const t = document.querySelector(sel);
          if (!t) return null;
          const h = document.querySelector('header');
          const hs = h ? getComputedStyle(h) : null;
          const headerH = hs && (hs.position === 'sticky' || hs.position === 'fixed')
            ? Math.round(h.getBoundingClientRect().height) : 0;
          const heading = t.querySelector('h1,h2,h3') || t;
          return {
            targetTop: Math.round(t.getBoundingClientRect().top),
            headingTop: Math.round(heading.getBoundingClientRect().top),
            headerH,
            scrollMarginTop: Math.round(parseFloat(getComputedStyle(t).scrollMarginTop) || 0),
          };
        }, href);
        if (res) {
          // ideal: the heading lands just below the sticky header
          data.anchorProbe.push({
            href, ...res,
            error: res.headingTop - res.headerH, // >0 = wasted space above content, <0 = hidden under header
          });
        }
      } catch { /* not clickable at this viewport */ }
    }

    /* screenshots */
    const dir = path.join(outDir, 'shots');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(dir, `${vp.name}-full.png`), fullPage: true });

    if (vp.name === 'desktop') {
      for (const g of data.gaps) {
        const a = data.sections[g.indices[0]], b = data.sections[g.indices[1]];
        const top = Math.max(0, a.box.bottom - 220);
        const height = Math.min(900, (b.box.top + 260) - top);
        if (height > 60) {
          await page.screenshot({
            path: path.join(dir, `seam-${g.indices[0]}-${g.indices[1]}.png`),
            fullPage: true,
            clip: { x: 0, y: top, width: vp.width, height },
          }).catch(() => {});
        }
      }
    }

    report.viewports[vp.name] = data;
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  /* stdout summary so the agent can triage before reading the JSON */
  const d = report.viewports.desktop;
  const scale = Object.entries(d.spacing).sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${url} ===`);
  console.log(`doc height ${d.docHeight}px · CLS ${d.cls} · ${d.sections.length} top-level blocks`);
  console.log(`\nSECTION SEAMS (ink gap = what the eye sees)`);
  for (const g of d.gaps) {
    console.log(`  ${String(g.inkGap).padStart(5)}px  ${g.between[0]} → ${g.between[1]}  ` +
      `[pb ${g.contributors.aPadBottom} + mb ${g.contributors.aMarBottom} + mt ${g.contributors.bMarTop} + pt ${g.contributors.bPadTop}]`);
  }
  console.log(`\nSPACING VALUES IN USE: ${scale.length} distinct — ${scale.slice(0, 14).map(([v, n]) => `${v}(${n})`).join(' ')}`);
  console.log(`TYPE STYLES IN USE: ${Object.keys(d.type).length} distinct size/lh/weight combos`);
  console.log(`CONTRAST FAILURES: ${d.contrast.length}`);
  console.log(`ANCHOR PROBE:`);
  for (const a of d.anchorProbe) {
    const verdict = Math.abs(a.error) <= 24 ? 'ok' : a.error > 0 ? `LANDS ${a.error}px TOO HIGH (dead space above heading)` : `HIDDEN ${-a.error}px UNDER HEADER`;
    console.log(`  ${a.href.padEnd(24)} ${verdict}`);
  }
  const m = report.viewports.mobile;
  console.log(`\nMOBILE: overflow ${m.overflow.scrollWidth - m.overflow.clientWidth}px · ` +
    `${m.tapTargets.length} sub-44px targets · CLS ${m.cls}`);
  console.log(`\nwrote ${path.join(outDir, 'report.json')} + ${fs.readdirSync(path.join(outDir, 'shots')).length} screenshots\n`);
};

run().catch(e => { console.error(e); process.exit(1); });
