// Собирает PDF и MP4 из report.html.
//   node docs/q3-report/render.cjs pdf | video | shots
// Нужны playwright и ffmpeg; музыка — python3 docs/q3-report/music.py
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');

const dir = __dirname;
const url = 'file://' + path.join(dir, 'report.html');
const FPS = 30;

(async () => {
  const mode = process.argv[2] || 'pdf';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  if (mode === 'pdf') {
    await page.goto(url + '?pdf');
    await page.evaluate(() => document.fonts.ready);
    await page.pdf({ path: path.join(dir, 'logos-q3-itogi.pdf'), width: '1920px', height: '1080px', printBackground: true });
  } else if (mode === 'shots') {
    await page.goto(url);
    for (const t of process.argv.slice(3).map(Number)) {
      await page.evaluate(t => window.seek(t), t);
      await page.screenshot({ path: path.join(process.env.OUT || dir, `shot-${t}.png`) });
    }
  } else {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    const dur = await page.evaluate(() => window.DURATION);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-i', path.join(dir, 'music.wav'), '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', path.join(dir, 'logos-q3-itogi.mp4')], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(dur * FPS);
    for (let f = 0; f < total; f++) {
      await page.evaluate(t => window.seek(t), f / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 300 === 0) console.log(`${f}/${total}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
