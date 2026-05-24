// Regenerates the widget preview PNGs from the current widget HTML.
// Approach: an in-process static file server per widget folder, a headless
// Chromium that screenshots both light and dark variants, written out to
// widgets/<id>/preview-{light,dark}.png.
//
// Usage: node scripts/generate-previews.mjs

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Per-widget config. Width is a typical card width on a Homey dashboard,
// height matches widget.compose.json. The final PNG is rendered at 3x DPR
// for crisp Retina display, then served to Homey at its native size.
const WIDGETS = [
  { id: 'verdict',  width: 480, height: 220 },
  { id: 'score',    width: 480, height: 260 },
  { id: 'forecast', width: 720, height: 140 },
];

const THEMES = [
  { name: 'light', bg: '#F5F5F7', textColor: '#1B1B1B' },
  { name: 'dark',  bg: '#1B1B1B', textColor: '#F5F5F5' },
];

// Mock Homey runtime that the widget HTML expects to be present. Returns
// plausible data so the layered scene renders in a "yes" state.
const MOCK_HOMEY_SCRIPT = `
<script>
  // Mock of the Homey API surface. Mirrors the Homey object that is normally
  // injected by the iframe host. The widget HTML calls onHomeyReady(Homey).
  window.Homey = {
    ready: () => {},
    getSettings: () => ({ show_details: true }),
    api: async (method, path) => {
      if (path === '/i18n') {
        return {
          verdicts: { yes: 'YES.', maybe: 'MAYBE', no: 'NO.' },
          loading: 'Loading...',
          score: 'Score',
          labels:   { yes: 'Fire it up!', maybe: 'Maybe', no: 'No BBQ' },
          kicker:   'Today',
          upcoming: 'Up next',
          max:      'of 100',
          days:     ['SUN','MON','TUE','WED','THU','FRI','SAT'],
          wind:     { light: 'light breeze', moderate: 'moderate', strong: 'strong', hard: 'hard', gale: 'gale' },
          rain:     { dry: 'dry', barelyWet: 'barely wet', lightShower: 'shower', showerExpected: 'shower expected', heavyRain: 'heavy rain' },
        };
      }
      if (path === '/status') {
        return {
          status: 'yes',
          score: 92,
          advice: 'Fire it up',
          temperature: 24,
          windSpeed: 8,
          windGusts: 12,
          rain: 0,
          humidity: 50,
          cloudCover: 25,
        };
      }
      if (path === '/forecast') {
        const today = new Date();
        const days = [];
        const scores = [92, 88, 95, 78, 64, 71, 89];
        const statuses = ['yes','yes','yes','yes','maybe','maybe','yes'];
        for (let i = 0; i < 7; i++) {
          const d = new Date(today); d.setDate(today.getDate() + i);
          days.push({
            date: d.toISOString().slice(0,10),
            status: statuses[i],
            score: scores[i],
          });
        }
        return { days };
      }
      return null;
    },
  };
  // Bridge: widgets expect Homey to call onHomeyReady(Homey). We do it after
  // a microtask so the page's own script runs first.
  Promise.resolve().then(() => {
    if (typeof onHomeyReady === 'function') onHomeyReady(window.Homey);
  });
</script>
`;

function makeServer(widgetDir) {
  return http.createServer(async (req, res) => {
    let filePath = path.join(widgetDir, 'public', decodeURIComponent(req.url));
    if (req.url === '/' || req.url === '') filePath = path.join(widgetDir, 'public', 'index.html');
    try {
      let body = await fs.readFile(filePath);
      let type = 'application/octet-stream';
      if (filePath.endsWith('.html')) {
        type = 'text/html';
        // Inject the mock Homey runtime just before </body>.
        let html = body.toString('utf8');
        html = html.replace('</body>', MOCK_HOMEY_SCRIPT + '</body>');
        body = Buffer.from(html, 'utf8');
      } else if (filePath.endsWith('.svg')) type = 'image/svg+xml';
      else if (filePath.endsWith('.png')) type = 'image/png';
      else if (filePath.endsWith('.css')) type = 'text/css';
      else if (filePath.endsWith('.js')) type = 'application/javascript';
      res.writeHead(200, { 'Content-Type': type });
      res.end(body);
    } catch (e) {
      res.writeHead(404);
      res.end('not found');
    }
  });
}

async function captureWidget(widget) {
  const widgetDir = path.join(ROOT, 'widgets', widget.id);
  const server = makeServer(widgetDir);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/index.html`;

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: { width: widget.width, height: widget.height, deviceScaleFactor: 3 },
  });
  try {
    for (const theme of THEMES) {
      const page = await browser.newPage();
      await page.setViewport({ width: widget.width, height: widget.height, deviceScaleFactor: 3 });
      await page.goto(baseUrl, { waitUntil: 'networkidle2' });
      // Apply the theme: dashboard background goes on <html>, Homey's text-color
      // is set as a CSS variable on the root. We do not touch document.body.background
      // so widgets with their own status gradient (verdict, score) keep it,
      // and widgets with a transparent body (forecast) show the dashboard
      // colour through.
      await page.evaluate((bg, fg) => {
        document.documentElement.style.setProperty('--homey-text-color', fg);
        document.documentElement.style.background = bg;
      }, theme.bg, theme.textColor);
      // Allow CSS transitions and image loads to settle.
      await new Promise(r => setTimeout(r, 800));
      const outPath = path.join(widgetDir, `preview-${theme.name}.png`);
      await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
      console.log(`  written: ${path.relative(ROOT, outPath)}`);
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  for (const w of WIDGETS) {
    console.log(`Rendering widget: ${w.id} (${w.width}x${w.height})`);
    await captureWidget(w);
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
