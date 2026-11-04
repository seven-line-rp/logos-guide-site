/* global window, document -- код в page.evaluate выполняется в браузере */
// Снимает промо-ролик в MP4: открывает /admin/promo?render=1, ставит время кадр за
// кадром (window.__promoSeek), делает снимок и склеивает кадры с озвучкой в ffmpeg.
// Нужны: запущенный сайт (npm run dev), Playwright с Chromium и ffmpeg.
//   node scripts/render-promo.mjs [адрес сайта] [кадров в секунду]
// По умолчанию http://127.0.0.1:5173 и 30 кадров/с. Результат:
//   public/promo/logos-promo-video.mp4 — только картинка, без звука. На неё в панели
//     накладывается любой голос (свой, записанный в браузере) и музыка;
//   public/promo/logos-promo.mp4 — готовый ролик: картинка, голос и музыка,
//     которая приседает, когда звучит голос.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// Playwright не входит в зависимости сайта: берём установленный в системе
// (require видит глобальные пакеты, import — нет). Поставить: npm i -g playwright.
const { chromium } = createRequire(import.meta.url)('playwright')

const base = process.argv[2] || 'http://127.0.0.1:5173'
const fps = Number(process.argv[3] || 30)
const silent = 'public/promo/logos-promo-video.mp4'
const out = 'public/promo/logos-promo.mp4'
const frames = mkdtempSync(join(tmpdir(), 'promo-frames-'))

const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] })
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} завершился с кодом ${code}`))))
})

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  await page.goto(`${base}/admin/promo?render=1&splash=0`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => typeof window.__promoSeek === 'function')
  await page.evaluate(() => document.fonts.ready)
  const duration = await page.evaluate(() => window.__promoDuration)
  const total = Math.ceil(duration * fps)
  for (let i = 0; i < total; i += 1) {
    await page.evaluate((t) => window.__promoSeek(t), i / fps)
    await page.screenshot({ path: join(frames, `${String(i).padStart(5, '0')}.png`) })
    if (i % fps === 0) process.stdout.write(`\r${Math.round((i / total) * 100)}%`)
  }
  process.stdout.write('\r100%\n')
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(frames, '%05d.png'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '23', '-pix_fmt', 'yuv420p', '-tune', 'animation', '-an', '-movflags', '+faststart', silent])
  // Обложка плеера: кадр, где уже видно «Первая пара. Новый корпус. Куда идти?».
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '2.6', '-i', silent, '-frames:v', '1', '-q:v', '4', 'public/promo/poster.jpg'])
  // Голос по центру, музыка под ним приглушается (sidechain) и возвращается в паузах.
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', 'public/promo/voice.mp3', '-i', 'public/promo/music.mp3',
    '-filter_complex', '[1:a]aformat=channel_layouts=stereo,asplit=2[v][key];[2:a][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450[m];[v][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out])
  console.log(`Готово: ${silent}, ${out}`)
} finally {
  await browser.close()
  rmSync(frames, { recursive: true, force: true })
}
