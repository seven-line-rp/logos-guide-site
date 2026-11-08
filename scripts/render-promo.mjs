/* global window, document -- код в page.evaluate выполняется в браузере */
// Снимает промо-ролик в MP4: открывает /admin/promo?render=1, ставит время кадр за
// кадром (window.__promoSeek), делает снимок и склеивает кадры с озвучкой в ffmpeg.
// Нужны: запущенный сайт (npm run dev), Playwright с Chromium и ffmpeg.
//   node scripts/render-promo.mjs [адрес сайта] [кадров в секунду] [--film=cartoon] [--audio-only]
// С --audio-only кадры не снимаются: картинка берётся из готового ролика, а звук
// собирается заново из voice/music. Нужно после переозвучки отдельных реплик.
// У мультика две версии: --film=cartoon (с матом) и --film=cartoon-clean (без мата).
// По умолчанию http://127.0.0.1:5173 и 30 кадров/с. С --film=cartoon снимается
// мультик (/admin/cartoon) в public/promo/cartoon/. Результат для промо-ролика:
//   public/promo/logos-promo-video.mp4 — только картинка, без звука. На неё в панели
//     накладывается любой голос (свой, записанный в браузере) и музыка;
//   public/promo/logos-promo.mp4 — готовый ролик: картинка, голос и музыка,
//     которая приседает, когда звучит голос.
import { spawn } from 'node:child_process'
import { mkdtempSync, renameSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { join } from 'node:path'

// С --audio-only кадры не снимаются (и Playwright не нужен): звук заново
// подкладывается в уже готовый ролик, картинка копируется как есть. Так обновляют
// озвучку после build-promo-voice.py --patch-dir, когда переозвучены отдельные
// реплики, а тайминги остались прежними.
const audioOnly = process.argv.includes('--audio-only')
const require = createRequire(import.meta.url)
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const film = (process.argv.find((arg) => arg.startsWith('--film=')) || '--film=promo').slice(7)
// Playwright нужен коротким рендерам; полнометражный бессловесный ролик
// строится отдельным потоковым Pillow/FFmpeg-рендерером.
let chromium
let chromiumPack = null
if (!audioOnly && film !== 'promo-long') {
  try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require('playwright-core')) }
  try { chromiumPack = require('@sparticuz/chromium').default } catch { /* обычный Playwright сам находит браузер */ }
}
// Что снимать: страница со сценой, видео без звука, готовый ролик, звук и кадр обложки.
const FILMS = {
  promo: { page: '/admin/promo', silent: 'public/promo/logos-promo-video.mp4', out: 'public/promo/logos-promo.mp4', dir: 'public/promo', poster: '2.6' },
  // Полнометражный вариант без диктора: музыка и оригинальные звуковые эффекты.
  'promo-long': { page: '/admin/promo?long-render=1', silent: 'public/promo/logos-promo-long-video.mp4', out: 'public/promo/logos-promo-long.mp4', dir: 'public/promo', poster: '12', voice: null, music: 'music-longform.mp3', musicOnly: true },
  cartoon: { page: '/admin/cartoon', silent: null, out: 'public/promo/cartoon/logos-cartoon.mp4', dir: 'public/promo/cartoon', poster: '9.4', voice: 'voice.mp3', music: 'music.mp3' },
  'cartoon-clean': { page: '/admin/cartoon?version=clean', silent: null, out: 'public/promo/cartoon/logos-cartoon-clean.mp4', dir: 'public/promo/cartoon', poster: '9.4', posterName: 'poster-clean.jpg', voice: 'voice-clean.mp3', music: 'music-clean.mp3' },
  // Вторая серия, «Вайб-кодинг». Обложка — Mr.Брекин между студентом и информатиком.
  cartoon2: { page: '/admin/cartoon?episode=2', silent: null, out: 'public/promo/cartoon/logos-cartoon-2.mp4', dir: 'public/promo/cartoon', poster: '30', posterName: 'poster-2.jpg', voice: 'voice-2.mp3', music: 'music-2.mp3' },
  'cartoon2-clean': { page: '/admin/cartoon?episode=2&version=clean', silent: null, out: 'public/promo/cartoon/logos-cartoon-2-clean.mp4', dir: 'public/promo/cartoon', poster: '30', posterName: 'poster-2-clean.jpg', voice: 'voice-2-clean.mp3', music: 'music-2-clean.mp3' },
}
if (!FILMS[film]) throw new Error(`Нет ролика ${film}: есть ${Object.keys(FILMS).join(', ')}`)
const { page: path, out, dir, poster, posterName } = FILMS[film]
const voice = FILMS[film].voice ?? 'voice.mp3'
const music = FILMS[film].music || 'music.mp3'
const musicOnly = Boolean(FILMS[film].musicOnly)
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

if (film === 'promo-long') {
  const python = process.env.PYTHON || 'python3'
  await run(python, ['scripts/render-promo-longform.py'])
  rmSync(frames, { recursive: true, force: true })
  process.exit(0)
}

// Голос по центру, музыка под ним приглушается (sidechain) и возвращается в паузах.
const MIX = '[1:a]aformat=channel_layouts=stereo,asplit=2[v][key];[2:a][key]sidechaincompress=threshold=0.02:ratio=5:attack=30:release=450[m];[v][m]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]'

if (audioOnly) {
  // ffmpeg не умеет писать в тот же файл, который читает: собираем рядом и подменяем.
  const remux = join(frames, 'remux.mp4')
  const audioInputs = musicOnly ? ['-i', `${dir}/${music}`, '-filter_complex', '[1:a]aformat=channel_layouts=stereo,alimiter=limit=0.95[a]']
    : ['-i', `${dir}/${voice}`, '-i', `${dir}/${music}`, '-filter_complex', MIX]
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', out, ...audioInputs,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
    '-shortest', '-movflags', '+faststart', remux])
  renameSync(remux, out)
  rmSync(frames, { recursive: true, force: true })
  console.log(`Готово (только звук): ${out}`)
  process.exit(0)
}

const browser = await chromium.launch(chromiumPack
  ? { args: chromiumPack.args, executablePath: await chromiumPack.executablePath(), headless: true }
  : {})
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
  // У адреса уже может быть ?version=…, тогда параметры съёмки идут через &.
  await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}render=1&splash=0`, { waitUntil: 'networkidle' })
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
  const audioInputs = musicOnly ? ['-i', `${dir}/${music}`, '-filter_complex', '[1:a]aformat=channel_layouts=stereo,alimiter=limit=0.95[a]']
    : ['-i', `${dir}/${voice}`, '-i', `${dir}/${music}`, '-filter_complex', MIX]
  await run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, ...audioInputs,
    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', out])
  console.log(`Готово: ${silent}, ${out}`)
} finally {
  await browser.close()
  rmSync(frames, { recursive: true, force: true })
}
