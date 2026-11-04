import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'

async function loadLocalEnvironment() {
  let contents
  try {
    contents = await readFile(resolve(process.cwd(), '.env'), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return
    throw error
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }
    process.env[match[1]] = value
  }
}

await loadLocalEnvironment()

const root = resolve(process.env.DIST_DIR || 'dist')
const port = Number(process.env.PORT || 3000)
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
}
const staticMissingPath = /\.(?:css|gif|html|ico|jpe?g|js|json|map|mp3|mp4|webm|png|svg|webmanifest|webp|xml|txt)$/i

try {
  await stat(root)
} catch {
  console.error(`Build output not found at ${root}. Run "npm run build" before starting the production server.`)
  process.exit(1)
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' })
  res.end(text)
}

// Разделы приложения: своя копия index.html с заголовком и описанием страницы
// (dist/_pages, пишет сборка), иначе обычный index.html. Так же делает .htaccess.
async function pageFile(pathname) {
  const match = pathname.match(/^\/([a-z-]+)$/)
  if (match) {
    const page = resolve(root, '_pages', `${match[1]}.html`)
    try { if ((await stat(page)).isFile()) return page } catch { /* такой страницы нет */ }
  }
  return resolve(root, 'index.html')
}

async function serveStatic(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed\n')

  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname)
  } catch {
    return sendText(res, 400, 'Bad Request\n')
  }
  if (pathname.split('/').some((part) => part.startsWith('.'))) return sendText(res, 404, 'Not Found\n')

  let file = resolve(root, `.${pathname}`)
  if (file !== root && !file.startsWith(`${root}${sep}`)) return sendText(res, 400, 'Bad Request\n')
  try {
    const details = await stat(file)
    // Папка без своего index.html (например /rooms, где лежат фото кабинетов)
    // совпадает с адресом раздела приложения: отдаём приложение.
    if (details.isDirectory()) {
      file = resolve(file, 'index.html')
      try { await stat(file) } catch { file = await pageFile(pathname) }
    } else if (!details.isFile()) return sendText(res, 404, 'Not Found\n')
  } catch {
    if (staticMissingPath.test(pathname) || pathname.startsWith('/assets/')) return sendText(res, 404, 'Not Found\n')
    file = await pageFile(pathname)
  }

  let details
  try {
    details = await stat(file)
    if (!details.isFile()) return sendText(res, 404, 'Not Found\n')
  } catch {
    return sendText(res, 404, 'Not Found\n')
  }

  const type = MIME_TYPES[extname(file).toLowerCase()] || 'application/octet-stream'
  const isHashedAsset = file.includes(`${sep}assets${sep}`)
  // Ролики и их звук (public/promo) пересобираются под теми же именами: браузер
  // перед показом сверяет копию с сервером, иначе играл бы старый ролик.
  const isPromo = file.includes(`${sep}promo${sep}`)
  const headers = {
    'Content-Type': type,
    'Cache-Control': extname(file) === '.html' || isPromo ? 'no-cache' : isHashedAsset ? 'public, max-age=2592000, immutable' : 'public, max-age=3600',
    'Last-Modified': details.mtime.toUTCString(),
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  }
  if (req.headers['if-modified-since'] && new Date(req.headers['if-modified-since']) >= new Date(details.mtime.toUTCString())) {
    res.writeHead(304, headers)
    return res.end()
  }
  // Видео браузеры грузят кусками (Range). Safari без этого ролик не играет вовсе.
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '')
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, details.size - Number(range[2]))
    const end = range[1] && range[2] ? Math.min(Number(range[2]), details.size - 1) : details.size - 1
    if (start >= details.size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${details.size}` })
      return res.end()
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${details.size}`, 'Content-Length': end - start + 1 })
    if (req.method === 'HEAD') return res.end()
    return createReadStream(file, { start, end }).pipe(res)
  }
  res.writeHead(200, { ...headers, 'Content-Length': details.size })
  if (req.method === 'HEAD') return res.end()
  return createReadStream(file).pipe(res)
}

const server = createServer((req, res) => { void serveStatic(req, res) })
server.requestTimeout = 35_000
server.headersTimeout = 40_000
server.listen(port, '0.0.0.0', () => {
  console.log(`LOGOS guide listening on http://0.0.0.0:${port}`)
})
