import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { createAssistantApiMiddleware } from './server/assistant-api.mjs'

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
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.webp': 'image/webp',
}
const staticMissingPath = /\.(?:css|gif|html|ico|jpe?g|js|json|map|mp3|png|svg|webmanifest|webp|xml|txt)$/i

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
    if (details.isDirectory()) file = resolve(file, 'index.html')
    else if (!details.isFile()) return sendText(res, 404, 'Not Found\n')
  } catch {
    if (staticMissingPath.test(pathname) || pathname.startsWith('/assets/')) return sendText(res, 404, 'Not Found\n')
    file = resolve(root, 'index.html')
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
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': details.size,
    'Cache-Control': extname(file) === '.html' ? 'no-cache' : isHashedAsset ? 'public, max-age=2592000, immutable' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  })
  if (req.method === 'HEAD') return res.end()
  return createReadStream(file).pipe(res)
}

const assistantApi = createAssistantApiMiddleware({
  apiKey: process.env.DEEPSEEK_API_KEY,
  trustProxy: process.env.TRUST_PROXY === 'true',
})

const server = createServer((req, res) => {
  void assistantApi(req, res, () => { void serveStatic(req, res) })
})
server.requestTimeout = 35_000
server.headersTimeout = 40_000
server.listen(port, '0.0.0.0', () => {
  console.log(`LOGOS guide listening on http://0.0.0.0:${port}; DeepSeek ${process.env.DEEPSEEK_API_KEY ? 'configured' : 'not configured'}`)
})
