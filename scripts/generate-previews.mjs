// Genereert de widget-preview-PNG's opnieuw vanuit de actuele widget-HTML.
// Aanpak: een in-process static fileserver per widget-folder, een headless
// Chromium die screenshots maakt voor zowel light als dark, weggeschreven
// naar widgets/<id>/preview-{light,dark}.png.
//
// Gebruik:  node scripts/generate-previews.mjs

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import url from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Configuratie per widget. De breedte is een gangbare kaartbreedte op een
// Homey-dashboard, de hoogte komt overeen met widget.compose.json. De PNG
// wordt op 3x DPR gerenderd voor scherpe Retina-weergave en daarna door
// Homey op zijn eigen formaat getoond.
const WIDGETS = [
  { id: 'verdict',  width: 480, height: 220 },
  { id: 'score',    width: 480, height: 260 },
  { id: 'forecast', width: 720, height: 140 },
];

const THEMES = [
  { name: 'light', bg: '#F5F5F7', textColor: '#1B1B1B' },
  { name: 'dark',  bg: '#1B1B1B', textColor: '#F5F5F5' },
];

// Een mock Homey-runtime die de widget-HTML verwacht. Levert geloofwaardige
// data zodat de gelaagde scene in een "ja"-staat rendert.
const MOCK_HOMEY_SCRIPT = `
<script>
  // Mock van het Homey-API-oppervlak. Bootst het Homey-object na dat normaal
  // door het iframe wordt ingespoten. De widget-HTML roept onHomeyReady(Homey) aan.
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
  // Brug: widgets verwachten dat Homey onHomeyReady(Homey) aanroept. We
  // doen het na een microtask zodat het script van de pagina eerst draait.
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
        // Inject mock-Homey just before </body> of index.html
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
      // Thema toepassen: de dashboard-achtergrond komt op <html>, de tekstkleur
      // van Homey komt als CSS-variabele op de root. We laten document.body.background
      // bewust met rust: widgets met een eigen status-gradient (verdict / score)
      // behouden die, en widgets met een transparante achtergrond (forecast)
      // tonen de dashboard-kleur erdoorheen.
      await page.evaluate((bg, fg) => {
        document.documentElement.style.setProperty('--homey-text-color', fg);
        document.documentElement.style.background = bg;
      }, theme.bg, theme.textColor);
      // Give CSS transitions + image loads a moment
      await new Promise(r => setTimeout(r, 800));
      const outPath = path.join(widgetDir, `preview-${theme.name}.png`);
      await page.screenshot({ path: outPath, type: 'png', omitBackground: false });
      console.log(`  ✓ ${path.relative(ROOT, outPath)}`);
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
