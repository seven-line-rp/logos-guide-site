/* global window, document -- код в page.evaluate выполняется в браузере */
// Снимает промо-ролик в MP4: открывает /admin/promo?render=1, ставит время кадр за
// кадром (window.__promoSeek), делает снимок и склеивает кадры с озвучкой в ffmpeg.
// Нужны: запущенный сайт (npm run dev), Playwright с Chromium и ffmpeg.
//   node scripts/render-promo.mjs [адрес сайта] [кадров в секунду] [--film=cartoon]
// У мультика две версии: --film=cartoon (с матом) и --film=cartoon-clean (без мата).
// По умолчанию http://127.0.0.1:5173 и 30 кадров/с. С --film=cartoon снимается
// мультик (/admin/cartoon) в public/promo/cartoon/. Результат для промо-ролика:
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

const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const film = (process.argv.find((arg) => arg.startsWith('--film=')) || '--film=promo').slice(7)
// Что снимать: страница со сценой, видео без звука, готовый ролик, звук и кадр обложки.
const FILMS = {
  promo: { page: '/admin/promo', silent: 'public/promo/logos-promo-video.mp4', out: 'public/promo/logos-promo.mp4', dir: 'public/promo', poster: '2.6' },
  cartoon: { page: '/admin/cartoon', silent: null, out: 'public/promo/cartoon/logos-cartoon.mp4', dir: 'public/promo/cartoon', poster: '9.4', voice: 'voice.mp3', music: 'music.mp3' },
  'cartoon-clean': { page: '/admin/cartoon?version=clean', silent: null, out: 'public/promo/cartoon/logos-cartoon-clean.mp4', dir: 'public/promo/cartoon', poster: '9.4', posterName: 'poster-clean.jpg', voice: 'voice-clean.mp3', music: 'music-clean.mp3' },
}
if (!FILMS[film]) throw new Error(`Нет ролика ${film}: есть ${Object.keys(FILMS).join(', ')}`)
const { page: path, out, dir, poster, posterName } = FILMS[film]
const voice = FILMS[film].voice || 'voice.mp3'
const music = FILMS[film].music || 'music.mp3'
const base = args[0] || 'http://127.0.0.1:5173'
const fps = Number(args[1] || 30)
const frames = mkdtempSync(join(tmpdir(), 'promo-frames-'))
// Промо-ролику нужен и файл без звука (на него в панели накладывается голос),
// мультику — нет: он собирается целиком здесь.
const silent = FILMS[film].silent || join(frames, 'video.mp4')

const run = (cmd, args) => new Promise((resolve, reject) => {
  const child = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] })
  child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} завершился с кодом ${code}`))))
})

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  await page.goto(`${base}${path}?render=1&splash=0`, { waitUntil: 'networkidle' })
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
  // Обложка плеера: у промо-ролика — кадр «Первая пара. Новый корпус. Куда идти?»,
  // у мультика — Mr.Брекин рядом со студентом.
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-ss', poster, '-i', silent, '-frames:v', '1', '-q:v', '4', `${dir}/${posterName || 'poster.jpg'}`])
  // Голос по центру, музыка под ним приглушается (sidechain) и возвращается в паузах.
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', `${dir}/${voice}`, '-i', `${dir}/${music}`,
    '-filter_complex', '[1:a]aformat=channel_layouts=stereo,asplit=2[v][key];[2:a][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450[m];[v][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]',
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out])
  console.log(`Готово: ${silent}, ${out}`)
} finally {
  await browser.close()
  rmSync(frames, { recursive: true, force: true })
}
