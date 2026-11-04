/* global window, document -- код в page.evaluate и addInitScript выполняется в браузере */
// Снимки настоящего интерфейса для промо-ролика: public/promo/shots/*.webp и
// координаты элементов на них (куда наезжает камера и где кликает курсор) в
// src/admin/promo-shots.json. Нужны запущенный сайт (npm run dev), Playwright и ffmpeg.
//   node scripts/capture-promo-shots.mjs [адрес сайта]
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const { chromium } = createRequire(import.meta.url)('playwright')
const base = process.argv[2] || 'http://127.0.0.1:5173'
const outDir = 'public/promo/shots'
const tmp = mkdtempSync(join(tmpdir(), 'promo-shots-'))
mkdirSync(outDir, { recursive: true })

// Четверг, перемена перед второй парой: на главной видно «Следующая пара».
const CLOCK = new Date('2026-11-05T10:31:00+03:00')
const LESSONS = [{ date: '2026-11-05', start: '10:40', end: '12:10', subject: 'Физика', roomId: 'physics-211' }]
const DESKTOP = { width: 1280, height: 720, scale: 1.6 }
const PHONE = { width: 390, height: 844, scale: 2 }
const shots = {}

function saveWebp(png, name, quality = 80) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', png, '-c:v', 'libwebp', '-quality', String(quality), '-compression_level', '6', join(outDir, `${name}.webp`)])
}

// still: «Уменьшить движение», чтобы анимации не смазывали снимок. На главной его
// нет: иначе не загрузится 3D-корпус первого экрана.
async function context(browser, view, still = true) {
  const ctx = await browser.newContext({ viewport: { width: view.width, height: view.height }, deviceScaleFactor: view.scale, isMobile: view === PHONE, hasTouch: view === PHONE, locale: 'ru-RU', timezoneId: 'Europe/Moscow', reducedMotion: still ? 'reduce' : 'no-preference' })
  await ctx.addInitScript((lessons) => {
    try {
      localStorage.setItem('logos-cookie-consent', JSON.stringify({ v: 1, functional: true, at: new Date().toISOString() }))
      localStorage.setItem('logos-tour-done', new Date().toISOString())
      localStorage.setItem('logos-schedule', JSON.stringify(lessons))
      localStorage.setItem('site-theme', 'light')
    } catch { /* приватный режим */ }
  }, LESSONS)
  const page = await ctx.newPage()
  await page.clock.setFixedTime(CLOCK)
  return { ctx, page }
}

async function shot(page, name, view, rects = {}) {
  const png = join(tmp, `${name}.png`)
  await page.screenshot({ path: png })
  saveWebp(png, name)
  const boxes = {}
  for (const [key, selector] of Object.entries(rects)) {
    const found = page.locator(selector).first()
    const box = (await found.count()) ? await found.boundingBox() : null
    if (box) boxes[key] = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) }
  }
  shots[name] = { src: `/promo/shots/${name}.webp`, w: view.width, h: view.height, rects: boxes }
  console.log(name, Object.keys(boxes).join(', '))
}

const open = async (page, path) => {
  await page.goto(`${base}${path}${path.includes('?') ? '&' : '?'}splash=0`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(900)
}

const browser = await chromium.launch()
try {
  // ---------- Компьютер ----------
  {
    const { ctx, page } = await context(browser, DESKTOP, false)
    await open(page, '/')
    await page.waitForTimeout(2500)
    await shot(page, 'home', DESKTOP, { search: '.home-search', hero: '.home-hero-copy' })
    await page.locator('.home-search input').click()
    for (const [index, text] of ['2', '21', '211'].entries()) {
      await page.keyboard.type(text.slice(-1))
      await page.waitForTimeout(350)
      await shot(page, `type-${index + 1}`, DESKTOP, { search: '.home-search', list: '.home-search-suggestions', first: '.home-search-suggestions > button' })
    }
    await ctx.close()
  }
  {
    const { ctx, page } = await context(browser, DESKTOP)
    await open(page, '/map?floor=2&room=physics-211')
    await shot(page, 'map', DESKTOP, { room: '.plan-room-selected, [data-room="physics-211"]', panel: '.room-detail-panel, .map-panel' })
    await open(page, '/route?from=entrance-1&to=physics-211')
    await page.waitForTimeout(1200)
    await shot(page, 'route-1', DESKTOP, { form: '.route-room-search', to: '.route-room-search >> nth=1', scene: '.rt-map', next: '.rt-next', now: '.rt-now-card', eta: '.rt-eta' })
    const next = page.locator('.rt-next, button:has-text("Дальше"), button[aria-label*="Следующ"]').first()
    for (const step of [2, 3]) {
      if (await next.count()) { await next.click().catch(() => {}); await page.waitForTimeout(1300) }
      await shot(page, `route-${step}`, DESKTOP, { scene: '.rt-map', next: '.rt-next', now: '.rt-now-card' })
    }
    await ctx.close()
  }
  // ---------- Телефон ----------
  {
    const { ctx, page } = await context(browser, PHONE)
    await open(page, '/')
    const day = page.locator('.day-card-lesson').first()
    await day.scrollIntoViewIfNeeded()
    await page.evaluate(() => window.scrollBy(0, -120))
    await page.waitForTimeout(500)
    await shot(page, 'phone-day', PHONE, { lesson: '.day-card-lesson' })
    await open(page, '/here?room=physics-211')
    await shot(page, 'phone-here', PHONE, { title: '.page-heading', nearest: '.here-card, .here-chips, .day-chips' })
    await ctx.close()
  }
} finally {
  await browser.close()
  rmSync(tmp, { recursive: true, force: true })
}
writeFileSync('src/admin/promo-shots.json', JSON.stringify(shots, null, 2) + '\n')
console.log('Готово:', Object.keys(shots).length, 'снимков')
