// Generates Athom-compliant widget preview PNGs per App Store Guideline 1.9:
//   - 1024 x 1024 canvas
//   - transparent background
//   - simple shapes, no text, no screenshots
//   - light and dark variants per widget
//
// Output:
//   widgets/<id>/preview-light.png
//   widgets/<id>/preview-dark.png
//
// Usage: node scripts/generate-previews.mjs

import puppeteer from 'puppeteer';
import path from 'node:path';
import url from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Inline the silhouette SVGs as base64 data URLs so the preview HTML works
// from a data: URL context (where file:// would be blocked).
const KETTLE_B64 = fs.readFileSync(path.join(ROOT, 'docs/svgs/kettle-large.svg')).toString('base64');
const FLAME_B64  = fs.readFileSync(path.join(ROOT, 'docs/svgs/flame.svg')).toString('base64');
const KETTLE_URL = `data:image/svg+xml;base64,${KETTLE_B64}`;
const FLAME_URL  = `data:image/svg+xml;base64,${FLAME_B64}`;

const ACCENT = '#D85A30'; // brand orange, used sparingly per guidelines

// Card body markup per widget. Kept abstract: shapes only, no text.
const WIDGETS = {
  verdict: {
    cardWidth: 800,
    cardHeight: 360,
    body: `
      <div class="row">
        <div class="bbq-wrap">
          <div class="bbq"></div>
          <div class="flame"></div>
        </div>
        <div class="bars">
          <div class="bar bar-headline"></div>
          <div class="bar bar-sub"></div>
        </div>
        <div class="chip chip-score"></div>
      </div>
      <div class="divider"></div>
      <div class="bar bar-footer"></div>
    `,
    css: `
      .card { display: flex; flex-direction: column; gap: 32px; padding: 44px 40px; }
      .row  { display: grid; grid-template-columns: 180px 1fr auto; gap: 36px; align-items: center; }
      .bbq-wrap { position: relative; width: 180px; height: 180px; }
      .bbq      { position: absolute; inset: 0; }
      .flame    { position: absolute; left: 26%; top: 18%; width: 32%; height: 32%; }
      .bars { display: flex; flex-direction: column; gap: 22px; }
      .bar-headline { width: 72%; height: 44px; }
      .bar-sub      { width: 50%; height: 22px; }
      .chip-score   { width: 140px; height: 84px; border-radius: 24px; }
      .divider      { height: 2px; background: var(--line); margin: 0 -10px; opacity: 0.6; }
      .bar-footer   { width: 60%; height: 20px; margin: 0 auto; }
    `,
  },

  score: {
    cardWidth: 800,
    cardHeight: 460,
    body: `
      <div class="row">
        <div class="bbq-wrap">
          <div class="bbq"></div>
          <div class="flame"></div>
        </div>
        <div class="bars">
          <div class="bar bar-kicker"></div>
          <div class="bar bar-headline"></div>
        </div>
        <div class="chip chip-score"></div>
      </div>
      <div class="divider"></div>
      <div class="bar bar-mid"></div>
      <div class="upcoming">
        <div class="pill pill-mini"></div>
        <div class="pill pill-mini"></div>
        <div class="pill pill-mini"></div>
      </div>
    `,
    css: `
      .card { display: flex; flex-direction: column; gap: 26px; padding: 40px 40px; }
      .row  { display: grid; grid-template-columns: 170px 1fr auto; gap: 32px; align-items: center; }
      .bbq-wrap { position: relative; width: 170px; height: 170px; }
      .bbq      { position: absolute; inset: 0; }
      .flame    { position: absolute; left: 26%; top: 18%; width: 32%; height: 32%; }
      .bars { display: flex; flex-direction: column; gap: 20px; }
      .bar-kicker   { width: 38%; height: 20px; }
      .bar-headline { width: 70%; height: 42px; }
      .chip-score   { width: 150px; height: 100px; border-radius: 22px; }
      .divider      { height: 2px; background: var(--line); margin: 4px -10px; opacity: 0.6; }
      .bar-mid      { width: 55%; height: 20px; margin: 0 auto; }
      .upcoming     { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
      .pill-mini    { height: 56px; border-radius: 16px; background: var(--pill-soft); }
    `,
  },

  forecast: {
    cardWidth: 940,
    cardHeight: 220,
    body: `
      <div class="grid">
        ${Array.from({ length: 7 }, () => `
          <div class="day">
            <div class="bbq"></div>
            <div class="bar bar-day"></div>
          </div>
        `).join('')}
      </div>
    `,
    css: `
      .card { padding: 30px 32px; }
      .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 14px; height: 100%; }
      .day  { display: flex; flex-direction: column; align-items: center; gap: 10px;
              background: var(--pill-soft); border-radius: 18px; padding: 18px 0; }
      .bbq      { width: 56%; aspect-ratio: 1; }
      .bar-day  { width: 56%; height: 14px; }
    `,
  },
};

function renderHtml(widget, mode, cfg) {
  const isLight = mode === 'light';
  const cardBg   = isLight ? '#FFFFFF' : '#2A2A2C';
  const barCol   = isLight ? '#E5E5E7' : '#404044';
  const lineCol  = isLight ? '#E5E5E7' : '#3A3A3C';
  const pillSoft = isLight ? '#F2F2F4' : '#1F1F21';
  // Kettle silhouette: dark in light mode, light in dark mode.
  const bbqFilter = isLight ? 'brightness(0)' : 'brightness(0) invert(1)';

  return `<!DOCTYPE html>
<html>
<head>
<style>
  html, body { margin: 0; padding: 0; width: 1024px; height: 1024px; background: transparent; }
  body { display: flex; align-items: center; justify-content: center; }

  .card {
    width: ${cfg.cardWidth}px;
    height: ${cfg.cardHeight}px;
    background: ${cardBg};
    border-radius: 32px;
    box-sizing: border-box;
    box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.10),
      0 4px 10px  rgba(0, 0, 0, 0.05);
    --line: ${lineCol};
    --pill-soft: ${pillSoft};
  }

  /* Skeleton bars: rounded gray placeholders */
  .bar  { background: ${barCol}; border-radius: 999px; }
  .chip {
    background: ${ACCENT};
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.22),
      inset 0 -2px 0 rgba(0,0,0,0.15);
  }

  /* BBQ kettle silhouette via mask */
  .bbq {
    background-image: url('${KETTLE_URL}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    filter: ${bbqFilter};
  }
  /* Flame accent silhouette via mask */
  .flame {
    background-image: url('${FLAME_URL}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

  ${cfg.css}
</style>
</head>
<body>
  <div class="card">${cfg.body}</div>
</body>
</html>`;
}

async function renderOne(browser, widgetId, mode, cfg) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await page.goto('data:text/html;charset=utf-8,' + encodeURIComponent(renderHtml(widgetId, mode, cfg)), {
    waitUntil: 'networkidle0',
  });
  // Allow background-image masks to settle.
  await new Promise(r => setTimeout(r, 250));
  const outPath = path.join(ROOT, 'widgets', widgetId, `preview-${mode}.png`);
  await page.screenshot({ path: outPath, type: 'png', omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  console.log(`  written: ${path.relative(ROOT, outPath)}`);
  await page.close();
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const [id, cfg] of Object.entries(WIDGETS)) {
      console.log(`Widget: ${id}`);
      await renderOne(browser, id, 'light', cfg);
      await renderOne(browser, id, 'dark',  cfg);
    }
    console.log('Done.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
