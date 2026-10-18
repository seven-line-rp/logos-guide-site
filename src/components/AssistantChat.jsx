import { useEffect, useRef, useState } from 'react'
import { Bot, Check, CircleHelp, LoaderCircle, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { Link } from 'react-router-dom'

const MAX_MESSAGE_LENGTH = 2000
const SUGGESTIONS = [
  'Где находится библиотека?',
  'Как построить маршрут между этажами?',
  'Что умеет этот сайт?',
]
const LINK_PATTERN = /\[([^\]]+)\]\((\/[^)\s]*)\)/g

function safeInternalPath(path) {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  try {
    const url = new URL(path, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (!/^\/(map|rooms|route|games|services|about)(?:[/?#]|$)/.test(url.pathname)) return null
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

function MessageContent({ content }) {
  const parts = []
  let previousEnd = 0
  let match
  let index = 0

  LINK_PATTERN.lastIndex = 0
  while ((match = LINK_PATTERN.exec(content)) !== null) {
    const path = safeInternalPath(match[2])
    if (!path) continue
    if (match.index > previousEnd) parts.push(content.slice(previousEnd, match.index))
    parts.push(<Link key={`link-${index}`} to={path}>{match[1]}</Link>)
    previousEnd = match.index + match[0].length
    index += 1
  }
  if (previousEnd < content.length) parts.push(content.slice(previousEnd))

  return <>{parts.length ? parts : content}</>
}

function connectionCopy(connection) {
  if (connection === 'ready') return 'DeepSeek отвечает'
  if (connection === 'configured') return 'Ключ DeepSeek настроен'
  if (connection === 'not-configured') return 'ИИ ещё не подключён'
  if (connection === 'offline') return 'Нет соединения с ИИ'
  return 'Проверяем настройку'
}

function errorCopy(code) {
  if (code === 'not_configured') return 'ИИ-помощник пока не подключён к серверу. Сообщение не отправлялось в DeepSeek.'
  if (code === 'rate_limited') return 'Сейчас слишком много запросов. Подождите минуту и попробуйте ещё раз.'
  if (code === 'invalid_request') return 'Не получилось отправить этот вопрос. Попробуйте сформулировать его короче.'
  if (code === 'timeout') return 'Ответ задерживается. Попробуйте отправить вопрос ещё раз.'
  return 'Не удалось связаться с ИИ-помощником. Попробуйте немного позже.'
}

export default function AssistantChat() {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState('checking')
  const launcherRef = useRef(null)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const formRef = useRef(null)
  const requestRef = useRef(null)
  const messageIdRef = useRef(0)

  const makeMessage = (role, content) => ({
    id: ++messageIdRef.current,
    role,
    content,
  })

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/chat/status', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('status_unavailable')
        return response.json()
      })
      .then((status) => setConnection(status.configured ? 'configured' : 'not-configured'))
      .catch(() => {
        if (!controller.signal.aborted) setConnection('offline')
      })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
        launcherRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [open, messages, busy])

  useEffect(() => () => requestRef.current?.abort(), [])

  const sendMessage = async (rawText) => {
    const text = rawText.trim()
    if (!text || busy) return

    const userMessage = makeMessage('user', text)
    const previousMessages = messages
    setMessages((current) => [...current, userMessage])
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setBusy(true)

    const controller = new AbortController()
    requestRef.current = controller
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [...previousMessages, userMessage]
            .filter((message) => message.role === 'user' || message.role === 'assistant')
            .slice(-14)
            .map(({ role, content }) => ({ role, content })),
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (payload.code === 'not_configured') setConnection('not-configured')
        throw new Error(payload.code || 'request_failed')
      }
      if (typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('empty_reply')
      setMessages((current) => [...current, makeMessage('assistant', payload.reply.trim())])
      setConnection('ready')
    } catch (error) {
      if (error.name !== 'AbortError') {
        const code = error.message || 'request_failed'
        if (!['not_configured', 'rate_limited', 'invalid_request', 'timeout'].includes(code)) setConnection('offline')
        setMessages((current) => [...current, makeMessage('assistant', errorCopy(code))])
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setBusy(false)
        inputRef.current?.focus()
      }
    }
  }

  const submit = (event) => {
    event.preventDefault()
    void sendMessage(draft)
  }

  const resetConversation = () => {
    requestRef.current?.abort()
    requestRef.current = null
    setBusy(false)
    setMessages([])
    setDraft('')
    inputRef.current?.focus()
  }

  const onDraftChange = (event) => {
    setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
    event.target.style.height = 'auto'
    event.target.style.height = `${Math.min(event.target.scrollHeight, 112)}px`
  }

  return (
    <div className="assistant-widget">
      {open && <section id="assistant-panel" className="assistant-panel" role="dialog" aria-modal="false" aria-labelledby="assistant-title">
        <header className="assistant-header">
          <span className="assistant-brand-icon" aria-hidden="true"><Sparkles size={19} /></span>
          <div className="assistant-heading-copy">
            <div className="assistant-title-line"><h2 id="assistant-title">ЛОГОС <span>AI</span></h2><small>БЕТА</small></div>
            <div className={`assistant-connection assistant-connection-${connection}`}><i aria-hidden="true" />{connectionCopy(connection)}</div>
          </div>
          <div className="assistant-header-actions">
            <button type="button" className="assistant-header-button" aria-label="Новый диалог" title="Новый диалог" onClick={resetConversation}><RotateCcw size={16} /></button>
            <button type="button" className="assistant-header-button" aria-label="Закрыть помощника" title="Закрыть" onClick={() => { setOpen(false); launcherRef.current?.focus() }}><X size={19} /></button>
          </div>
        </header>

        <div className="assistant-conversation" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text">
          {messages.length === 0 ? <div className="assistant-welcome">
            <span className="assistant-welcome-glyph"><Bot size={25} strokeWidth={1.7} /></span>
            <span className="assistant-eyebrow"><i /> ПОМОЩНИК ПО КОЛЛЕДЖУ</span>
            <h3>Привет!<br /><em>Куда подсказать?</em></h3>
            <p>Помогу разобраться с картой, кабинетами и возможностями сайта. Спрашивай простыми словами.</p>
            <div className="assistant-suggestions-label"><CircleHelp size={14} /> Например</div>
            <div className="assistant-suggestions">
              {SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => void sendMessage(suggestion)} disabled={busy}>{suggestion}</button>)}
            </div>
            <div className="assistant-honesty"><Sparkles size={13} /><span>Если точных данных на сайте нет, я так и скажу.</span></div>
          </div> : <div className="assistant-message-list">
            {messages.map((message) => <article key={message.id} className={`assistant-message assistant-message-${message.role}`}>
              {message.role === 'assistant' && <span className="assistant-message-avatar" aria-hidden="true"><Sparkles size={13} /></span>}
              <div className="assistant-message-content"><MessageContent content={message.content} /></div>
            </article>)}
            {busy && <div className="assistant-message assistant-message-assistant assistant-message-pending" aria-label="Помощник печатает">
              <span className="assistant-message-avatar" aria-hidden="true"><Sparkles size={13} /></span>
              <div className="assistant-typing"><i /><i /><i /><span>Думаю</span></div>
            </div>}
          </div>}
        </div>

        <div className="assistant-composer-wrap">
          <form className="assistant-composer" ref={formRef} onSubmit={submit}>
            <label className="visually-hidden" htmlFor="assistant-message">Написать сообщение помощнику</label>
            <textarea
              id="assistant-message"
              ref={inputRef}
              rows={1}
              value={draft}
              onChange={onDraftChange}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  formRef.current?.requestSubmit()
                }
              }}
              placeholder="Напишите свой вопрос…"
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={busy}
            />
            <button className="assistant-send" type="submit" disabled={busy || !draft.trim()} aria-label="Отправить сообщение" title="Отправить">
              {busy ? <LoaderCircle size={18} className="assistant-send-loading" /> : <Send size={17} />}
            </button>
          </form>
          <div className="assistant-composer-foot"><span>Ответы могут быть неточными · ИИ в бете</span><span>{draft.length}/{MAX_MESSAGE_LENGTH}</span></div>
          <p className="assistant-privacy"><Check size={12} /> При ответе сообщения передаются DeepSeek; сайт их не хранит</p>
        </div>
      </section>}

      <button
        type="button"
        className={`assistant-launcher ${open ? 'assistant-launcher-open' : ''}`}
        ref={launcherRef}
        aria-expanded={open}
        aria-controls="assistant-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="assistant-launcher-icon"><MessageCircle size={19} /><i><Sparkles size={9} /></i></span>
        <span className="assistant-launcher-copy"><strong>{open ? 'Свернуть помощника' : 'Спросить помощника'}</strong><small>Колледж и путеводитель</small></span>
        <span className="assistant-launcher-beta">AI</span>
      </button>
    </div>
  )
}
