import { ASSISTANT_SYSTEM_PROMPT } from './assistant-knowledge.mjs'

const API_URL = 'https://api.deepseek.com/chat/completions'
const API_MODEL = 'deepseek-flash'
const MAX_BODY_BYTES = 32 * 1024
const MAX_MESSAGES = 16
const MAX_MESSAGE_CHARS = 4000
const MAX_TOTAL_CHARS = 24_000
const MAX_REQUESTS_PER_MINUTE = 12
const RATE_WINDOW_MS = 60_000
const UPSTREAM_TIMEOUT_MS = 30_000
const requestTimesByClient = new Map()

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
})

function isWithinRateLimit(clientKey, now) {
  if (!clientKey) return true
  const recent = (requestTimesByClient.get(clientKey) || []).filter((time) => now - time < RATE_WINDOW_MS)
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
    requestTimesByClient.set(clientKey, recent)
    return false
  }
  recent.push(now)
  requestTimesByClient.set(clientKey, recent)
  if (requestTimesByClient.size > 4000) {
    for (const [key, times] of requestTimesByClient) {
      if (!times.some((time) => now - time < RATE_WINDOW_MS)) requestTimesByClient.delete(key)
    }
  }
  return true
}

function validateMessages(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_MESSAGES) return null
  let totalChars = 0
  const messages = []
  for (const message of value) {
    if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null
    const content = message.content.trim()
    if (!content || content.length > MAX_MESSAGE_CHARS) return null
    totalChars += content.length
    if (totalChars > MAX_TOTAL_CHARS) return null
    messages.push({ role: message.role, content })
  }
  if (messages.at(-1)?.role !== 'user') return null
  return messages
}

export async function handleAssistantApiRequest(request, {
  apiKey = process.env.DEEPSEEK_API_KEY,
  fetchImpl = globalThis.fetch,
  now = Date.now(),
  clientKey,
  systemPrompt = ASSISTANT_SYSTEM_PROMPT,
} = {}) {
  const url = new URL(request.url)
  const key = typeof apiKey === 'string' ? apiKey.trim() : ''

  if (url.pathname === '/api/chat/status') {
    if (request.method !== 'GET') return json(405, { code: 'method_not_allowed' })
    return json(200, { configured: Boolean(key), provider: 'DeepSeek', model: API_MODEL })
  }

  if (url.pathname !== '/api/chat') return json(404, { code: 'not_found' })
  if (request.method !== 'POST') return json(405, { code: 'method_not_allowed' })
  if (!key) return json(503, { code: 'not_configured' })
  if (!isWithinRateLimit(clientKey, now)) return json(429, { code: 'rate_limited' })

  let payload
  try {
    payload = await request.json()
  } catch {
    return json(400, { code: 'invalid_request' })
  }

  const messages = validateMessages(payload?.messages)
  if (!messages) return json(400, { code: 'invalid_request' })
  if (typeof fetchImpl !== 'function') return json(503, { code: 'provider_unavailable' })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
  try {
    const upstream = await fetchImpl(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: API_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 700,
        thinking: { type: 'disabled' },
        temperature: 0.35,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!upstream.ok) {
      if (upstream.status === 429) return json(429, { code: 'rate_limited' })
      console.warn(`[assistant] DeepSeek returned HTTP ${upstream.status}`)
      return json(502, { code: 'provider_error' })
    }

    const data = await upstream.json().catch(() => null)
    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      console.warn('[assistant] DeepSeek returned an empty response')
      return json(502, { code: 'provider_error' })
    }
    return json(200, { reply: reply.trim() })
  } catch (error) {
    if (error?.name === 'AbortError') return json(504, { code: 'timeout' })
    console.warn('[assistant] DeepSeek request failed')
    return json(502, { code: 'provider_error' })
  } finally {
    clearTimeout(timeout)
  }
}

function jsonHttpResponse(response, res) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => res.setHeader(key, value))
  return response.text().then((body) => res.end(body))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    let tooLarge = false
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        tooLarge = true
        chunks.length = 0
      } else if (!tooLarge) {
        chunks.push(chunk)
      }
    })
    req.on('end', () => {
      if (tooLarge) reject(Object.assign(new Error('body_too_large'), { statusCode: 413 }))
      else resolve(Buffer.concat(chunks).toString('utf8'))
    })
    req.on('error', reject)
    req.on('aborted', () => reject(new Error('request_aborted')))
  })
}

function clientAddress(req, trustProxy) {
  if (trustProxy) {
    const forwardedFor = req.headers['x-forwarded-for']
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function writeError(res, status, code) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(JSON.stringify({ code }))
}

export function createAssistantApiMiddleware(options = {}) {
  return async function assistantApiMiddleware(req, res, next) {
    let url
    try {
      url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    } catch {
      return next?.()
    }

    if (!['/api/chat', '/api/chat/status'].includes(url.pathname)) return next?.()

    const method = req.method || 'GET'
    if (method === 'POST' && Number(req.headers['content-length']) > MAX_BODY_BYTES) {
      req.resume()
      return writeError(res, 413, 'request_too_large')
    }

    try {
      let body
      if (method === 'POST') body = await readBody(req)
      const headers = new Headers()
      if (req.headers['content-type']) headers.set('Content-Type', req.headers['content-type'])
      const request = new Request(url, { method, headers, body: body || undefined })
      const response = await handleAssistantApiRequest(request, {
        ...options,
        clientKey: clientAddress(req, options.trustProxy === true),
      })
      return jsonHttpResponse(response, res)
    } catch (error) {
      if (error?.statusCode === 413) return writeError(res, 413, 'request_too_large')
      if (error?.name === 'AbortError') return writeError(res, 400, 'request_aborted')
      console.error('[assistant] Failed to handle API request')
      return writeError(res, 500, 'server_error')
    }
  }
}
