#!/usr/bin/env node
'use strict';

/**
 * Lokale preview-server voor de drie BBQ-widgets.
 *
 *   node preview/serve.js
 *   -> http://localhost:3100/
 *
 * Serveert de preview-harness, de echte widget-HTML's en de locales-JSON.
 * Gebruikt alleen Node built-ins, geen externe dependencies.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PREVIEW_DIR = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 3100;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
};

function resolveFile(urlPath) {
  // Bestanden van de preview-harness zelf.
  if (urlPath === '/' || urlPath === '/index.html') {
    return path.join(PREVIEW_DIR, 'index.html');
  }
  // Al het overige relatief tot de project-root (widgets, locales, assets).
  const clean = urlPath.replace(/^\/+/, '');
  const abs = path.resolve(PROJECT_ROOT, clean);
  // Beveiliging tegen path traversal.
  if (!abs.startsWith(PROJECT_ROOT)) return null;
  return abs;
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const filePath = resolveFile(urlPath);

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  /* eslint-disable no-console */
  console.log('');
  console.log('  \x1b[1;33mBBQ widgets preview\x1b[0m');
  console.log('  \u2192 \x1b[36mhttp://localhost:' + PORT + '/\x1b[0m');
  console.log('  Ctrl+C om te stoppen');
  console.log('');
});
