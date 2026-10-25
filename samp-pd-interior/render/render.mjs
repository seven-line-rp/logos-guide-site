// Рендер превью: node render/render.mjs <three_dir> <out_dir> [shot ...]
// <three_dir> — папка пакета three (npm i three@0.160.0 → node_modules/three).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [threeDir, outDir, ...names] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.obj': 'text/plain' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = u.startsWith('/three/') ? path.join(threeDir, u.slice(7)) : path.join(root, u);
  if (!f.startsWith(threeDir) && !f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
await new Promise(r => server.once('listening', r));
const port = server.address().port;
const shots = names.length ? names : Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'render/shots.json'))));
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on('pageerror', e => console.log('pageerror', e.message));
  page.on('console', m => m.type() === 'error' && console.log('console', m.text()));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/render/viewer.html?shot=${s}`);
  await page.waitForFunction('window.__done === true', null, { timeout: 280000 });
  await page.screenshot({ path: path.join(outDir, `${s}.png`) });
  console.log(s, ((Date.now() - t0) / 1000).toFixed(1) + 's');
  await page.close();
}
await browser.close(); server.close();
