// Собирает PDF и MP4 из report.html.
//   node docs/q3-report/render.cjs pdf
//   node docs/q3-report/render.cjs video          (3 потока, смаз движения из 60 подкадров/с)
//   node docs/q3-report/render.cjs shots 3.5 12   (кадры для проверки, OUT=папка)
// Нужны playwright и ffmpeg. Музыка: music.mp3 (см. README.md).
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const url = 'file://' + path.join(dir, 'report.html');
const FPS = 30, SUB = 3, WORKERS = 4;

async function open(browser) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]));
  return page;
}

async function segment(browser, from, to, out) {
  const page = await open(browser);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS * SUB), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `tmix=frames=${SUB},fps=${FPS}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = from; f < to; f++) {
    for (let s = 0; s < SUB; s++) {
      await page.evaluate(t => window.seek(t), (f + s / SUB) / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await page.close();
}

(async () => {
  const mode = process.argv[2] || 'pdf';
  const browser = await chromium.launch();
  if (mode === 'pdf') {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    await page.goto(url + '?pdf');
    await page.evaluate(() => Promise.all([document.fonts.ready, ...[...document.images].map(i => i.decode().catch(() => {}))]));
    await page.pdf({ path: path.join(dir, 'logos-q3-itogi.pdf'), width: '1920px', height: '1080px', printBackground: true });
  } else if (mode === 'shots') {
    const page = await open(browser);
    for (const t of process.argv.slice(3).map(Number)) {
      await page.evaluate(t => window.seek(t), t);
      await page.screenshot({ path: path.join(process.env.OUT || dir, `shot-${t}.png`) });
    }
  } else {
    const probe = await open(browser);
    const total = Math.round(await probe.evaluate(() => window.DURATION) * FPS);
    await probe.close();
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'q3-'));
    const parts = [];
    await Promise.all([...Array(WORKERS)].map((_, i) => {
      const out = path.join(tmp, `part${i}.mp4`); parts.push(out);
      return segment(browser, Math.round(total * i / WORKERS), Math.round(total * (i + 1) / WORKERS), out);
    }));
    fs.writeFileSync(path.join(tmp, 'list.txt'), parts.map(p => `file '${p}'`).join('\n'));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt'), '-i', path.join(dir, 'music.mp3'),
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(dir, 'logos-q3-itogi.mp4')]);
    fs.rmSync(tmp, { recursive: true });
  }
  await browser.close();
})();
