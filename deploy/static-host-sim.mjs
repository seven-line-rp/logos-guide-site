// Локальная имитация хостинга — проверка перезагрузки страниц без публикации на reg.ru.
// Не входит в сборку сайта, запускается вручную:
//
//   npm run build
//   node deploy/static-host-sim.mjs dist            # MODE=spa — так должно быть после правки сервера
//   MODE=error404 node deploy/static-host-sim.mjs   # хостинг без SPA-фолбэка, но со страницей 404.html
//   MODE=naive node deploy/static-host-sim.mjs      # обычная серверная «404 Not Found» (текущая ошибка)
//
// Windows (PowerShell): $env:MODE='naive'; node deploy/static-host-sim.mjs dist
//
// В режиме spa повторяются правила public/.htaccess и deploy/nginx-spa.conf:
// существующий файл отдаётся как есть, отсутствующая статика честно даёт 404,
// а любой остальной адрес открывает index.html.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'

const ROOT = process.argv[2] ?? 'dist'
const MODE = process.env.MODE ?? 'spa'
const PORT = Number(process.env.PORT ?? 4173)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.webmanifest': 'application/manifest+json',
  '.ico': 'image/x-icon',
}

// Адреса, которые никогда не должны попадать в index.html (см. правило 2 в .htaccess).
const STATIC_PATH = /^\/(assets|voice|team)\//
const STATIC_EXT = /\.(js|mjs|css|map|mp3|png|jpe?g|gif|svg|webp|ico|webmanifest|xml|txt)$/i

const isFile = async (path) => {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
  let pathname = decodeURIComponent(url.pathname)
  if (pathname.endsWith('/')) pathname += 'index.html'
  const safe = normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const file = join(ROOT, safe)

  const send = async (path, status) => {
    const body = await readFile(path)
    res.writeHead(status, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' })
    res.end(body)
  }
  const notFound = () => {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('404 Not Found\n')
  }

  if (await isFile(file)) return send(file, 200)

  const isStatic = STATIC_PATH.test(safe) || STATIC_EXT.test(safe)
  if (MODE === 'spa') return isStatic ? notFound() : send(join(ROOT, 'index.html'), 200)
  if (MODE === 'error404') return isStatic ? notFound() : send(join(ROOT, '404.html'), 404)
  return notFound()
}).listen(PORT, '0.0.0.0', () => {
  console.log(`[${MODE}] http://0.0.0.0:${PORT} root=${ROOT}`)
})
