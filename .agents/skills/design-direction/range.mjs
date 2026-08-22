#!/usr/bin/env node
/**
 * range.mjs — compositional dynamic range meter.
 *
 * A page can pass every correctness check and still be dead. Dead pages are
 * almost always pages where everything is medium: medium size, medium weight,
 * medium density, medium saturation. This script measures how wide the page's
 * range actually is on each axis, so "it looks flat" becomes a number.
 *
 * Usage:
 *   node range.mjs <url> [--accent=#E9B949,#F5C518] [--channel=chrome] [--width=1440]
 */

import { chromium } from 'playwright';

const args = process.argv.slice(2);
const url = args[0];
const arg = (k, d) => (args.find(a => a.startsWith(`--${k}=`)) || `--${k}=${d}`).split('=')[1];
const accents = arg('accent', '').split(',').filter(Boolean).map(s => s.trim().toLowerCase());
const channel = arg('channel', 'chrome');
const width = Number(arg('width', 1440));

if (!url) { console.error('usage: node range.mjs <url> [--accent=#hex,#hex] [--channel=chrome]'); process.exit(1); }

const MEASURE = accentList => {
  const px = v => parseFloat(v) || 0;
  const hex = c => {
    const m = c.match(/\d+/g);
    if (!m) return null;
    return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('').toLowerCase();
  };
  const nodes = [...document.querySelectorAll('body *')];
  const visible = nodes.filter(n => {
    const r = n.getBoundingClientRect();
    const s = getComputedStyle(n);
    return r.width > 1 && r.height > 1 && s.display !== 'none' && s.visibility !== 'hidden' && px(s.opacity) > 0.05;
  });

  /* ---- type range ------------------------------------------------ */
  const textNodes = visible.filter(n => [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim().length > 1));
  const sizes = textNodes.map(n => px(getComputedStyle(n).fontSize)).filter(Boolean);
  const weights = textNodes.map(n => Number(getComputedStyle(n).fontWeight) || 400);
  const families = new Set(textNodes.map(n => getComputedStyle(n).fontFamily.split(',')[0].replace(/["']/g, '').trim()));
  const bodySize = (() => {
    const h = {};
    for (const s of sizes) h[s] = (h[s] || 0) + 1;
    return Number(Object.entries(h).sort((a, b) => b[1] - a[1])[0]?.[0] || 16);
  })();

  /* ---- surface vocabulary ---------------------------------------- */
  const radii = {}, shadows = {}, borders = {};
  for (const n of visible) {
    const s = getComputedStyle(n);
    const r = Math.round(px(s.borderTopLeftRadius));
    if (r > 0) radii[r] = (radii[r] || 0) + 1;
    if (s.boxShadow && s.boxShadow !== 'none') shadows[s.boxShadow.slice(0, 40)] = (shadows[s.boxShadow.slice(0, 40)] || 0) + 1;
    const bw = Math.round(px(s.borderTopWidth));
    if (bw > 0) borders[bw] = (borders[bw] || 0) + 1;
  }

  /* ---- accent economy -------------------------------------------- */
  let accentHits = 0, colored = 0;
  const paletteUse = {};
  for (const n of visible) {
    const s = getComputedStyle(n);
    for (const prop of ['color', 'backgroundColor', 'borderTopColor']) {
      const h = hex(s[prop]);
      if (!h) continue;
      const m = s[prop].match(/[\d.]+/g);
      if (m && m.length > 3 && Number(m[3]) < 0.1) continue;
      paletteUse[h] = (paletteUse[h] || 0) + 1;
      if (accentList.includes(h)) accentHits++;
      colored++;
    }
  }

  /* ---- density map ------------------------------------------------ */
  const H = document.documentElement.scrollHeight;
  const bands = 24, bandH = H / bands;
  const density = new Array(bands).fill(0);
  for (const n of visible) {
    if (n.children.length > 0) continue;              // leaves only: actual ink
    const r = n.getBoundingClientRect();
    const top = r.top + scrollY, bottom = r.bottom + scrollY;
    const area = r.width * r.height;
    for (let b = 0; b < bands; b++) {
      const bt = b * bandH, bb = bt + bandH;
      const overlap = Math.max(0, Math.min(bottom, bb) - Math.max(top, bt));
      if (overlap > 0) density[b] += area * (overlap / Math.max(1, r.height));
    }
  }
  const bandArea = width * bandH;
  const coverage = density.map(d => Number((d / bandArea).toFixed(3)));

  return {
    docHeight: H,
    type: {
      maxSize: Math.max(...sizes), minSize: Math.min(...sizes), bodySize,
      displayToBodyRatio: Number((Math.max(...sizes) / bodySize).toFixed(2)),
      distinctSizes: new Set(sizes.map(s => Math.round(s))).size,
      weightRange: [Math.min(...weights), Math.max(...weights)],
      distinctWeights: [...new Set(weights)].sort((a, b) => a - b),
      families: [...families],
    },
    surface: {
      distinctRadii: Object.entries(radii).sort((a, b) => b[1] - a[1]),
      distinctShadows: Object.keys(shadows).length,
      distinctBorderWidths: Object.keys(borders).sort(),
    },
    color: {
      distinctColors: Object.keys(paletteUse).length,
      top: Object.entries(paletteUse).sort((a, b) => b[1] - a[1]).slice(0, 10),
      accentShare: colored ? Number((accentHits / colored).toFixed(4)) : null,
    },
    density: { coverage, min: Math.min(...coverage), max: Math.max(...coverage) },
  };
};

const bar = v => '█'.repeat(Math.max(0, Math.round(v * 40)));

(async () => {
  let browser;
  try { browser = await chromium.launch({ channel }); }
  catch { browser = await chromium.launch(); }
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready).catch(() => {});
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 60));
    }
    scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
  });
  const m = await page.evaluate(MEASURE, accents);
  await browser.close();

  console.log(`\n=== dynamic range · ${url} ===\n`);
  console.log(`TYPE`);
  console.log(`  display/body ratio   ${m.type.displayToBodyRatio}×   ${m.type.displayToBodyRatio < 3 ? '← flat. striking pages usually run 4–8×' : 'ok'}`);
  console.log(`  weights in use       ${m.type.distinctWeights.join(', ')}   ${m.type.distinctWeights.length < 3 ? '← narrow' : ''}`);
  console.log(`  distinct sizes       ${m.type.distinctSizes}   ${m.type.distinctSizes > 12 ? '← no scale, just values' : ''}`);
  console.log(`  families             ${m.type.families.slice(0, 4).join(' | ')}   ${m.type.families.length < 2 ? '← single voice' : ''}`);
  console.log(`\nSURFACE`);
  console.log(`  radii                ${m.surface.distinctRadii.slice(0, 6).map(([v, n]) => `${v}px(${n})`).join(' ')}`);
  console.log(`  shadow variants      ${m.surface.distinctShadows}`);
  console.log(`  border widths        ${m.surface.distinctBorderWidths.join(', ') || 'none'}`);
  console.log(`\nCOLOR`);
  console.log(`  distinct colors      ${m.color.distinctColors}`);
  console.log(`  accent share         ${m.color.accentShare === null ? 'n/a (pass --accent)' : (m.color.accentShare * 100).toFixed(1) + '%'}`);
  console.log(`  most used            ${m.color.top.slice(0, 6).map(([c, n]) => `${c}(${n})`).join(' ')}`);
  console.log(`\nDENSITY BY BAND (ink coverage, top → bottom)`);
  m.density.coverage.forEach((c, i) => console.log(`  ${String(i).padStart(2)} ${bar(c)} ${c}`));
  const ratio = m.density.max / Math.max(0.001, m.density.min);
  console.log(`\n  max/min ${ratio.toFixed(1)}×  ${ratio < 4 ? '← uniform. no rest, no climax; the page has one texture end to end' : 'ok'}`);
  console.log();
})();
