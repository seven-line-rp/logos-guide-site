import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bot, Check, ChevronRight, CircleHelp, GraduationCap, History, LoaderCircle, MessageCircle,
  MessageSquarePlus, PanelLeft, Pencil, Send, Sparkles, Trash2, X,
} from 'lucide-react'
import { onAssistantOpen, onTourStart, startTour } from '../assistant-bus.js'
import {
  EMPTY_CHAT_TITLE, MAX_MESSAGE_LENGTH, chatPreview, createChat, formatChatTime, historyForModel,
  messageCountLabel, readActiveChatId, readChats, removeChat, renameChat, titleFromMessages,
  upsertChat, writeActiveChatId, writeChats,
} from '../assistant-chat-store.js'
import { TUTORIAL_COMMAND, isTutorialCommand } from '../tutorial.js'

const LINK_PATTERN = /\[([^\]]+)\]\((\/[^)\s]*)\)/g
const SUGGESTIONS = [
  'Где находится библиотека?',
  'Как построить маршрут между этажами?',
  'Что умеет этот сайт?',
]
const TOUR_REPLY = 'Запускаю обучение по сайту: подсвечу главные элементы и подскажу, что делать на каждом шаге. '
  + 'Пропустить можно в любой момент, а чтобы повторить — снова напишите команду «Туторил».'

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
  if (connection === 'ready') return 'LOGOS AI на связи'
  if (connection === 'configured') return 'LOGOS AI готов к работе'
  if (connection === 'not-configured') return 'ИИ ещё не подключён'
  if (connection === 'offline') return 'Нет соединения с ИИ'
  return 'Проверяем подключение'
}

function errorCopy(code) {
  if (code === 'not_configured') return 'ИИ-помощник пока не подключён к серверу. Сообщение не отправлялось.'
  if (code === 'rate_limited') return 'Сейчас слишком много запросов. Подождите минуту и попробуйте ещё раз.'
  if (code === 'invalid_request') return 'Не получилось отправить этот вопрос. Попробуйте сформулировать его короче.'
  if (code === 'timeout') return 'Ответ задерживается. Попробуйте отправить вопрос ещё раз.'
  return 'Не удалось связаться с LOGOS AI. Попробуйте немного позже.'
}

function BrandMark({ size = 19 }) {
  return <span className="ai-brand-mark" aria-hidden="true"><Sparkles size={size} strokeWidth={1.8} /></span>
}

function ChatList({ chats, activeId, onSelect, onNew, onDelete, renamingId, renameValue, onRenameValue, onStartRename, onCommitRename }) {
  return (
    <div className="ai-sidebar">
      <div className="ai-sidebar-head">
        <span className="ai-sidebar-title"><History size={14} /> Диалоги</span>
        <button type="button" className="ai-new-chat" onClick={onNew}><MessageSquarePlus size={15} /> Новый чат</button>
      </div>
      <div className="ai-chat-list" role="listbox" aria-label="Сохранённые диалоги">
        {chats.length ? chats.map((chat) => (
          <div
            key={chat.id}
            role="option"
            aria-selected={chat.id === activeId}
            tabIndex={0}
            className={`ai-chat-item ${chat.id === activeId ? 'ai-chat-item-active' : ''}`}
            onClick={() => onSelect(chat.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onSelect(chat.id)
              }
            }}
          >
            {renamingId === chat.id ? (
              <input
                className="ai-chat-rename"
                value={renameValue}
                autoFocus
                maxLength={60}
                aria-label="Название диалога"
                onChange={(event) => onRenameValue(event.target.value)}
                onBlur={onCommitRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onCommitRename()
                  if (event.key === 'Escape') onCommitRename()
                }}
                onClick={(event) => event.stopPropagation()}
              />
            ) : (
              <span className="ai-chat-copy">
                <strong>{chat.title}</strong>
                <small>{chatPreview(chat)}</small>
                <em>{messageCountLabel(chat.messages.length)} · {formatChatTime(chat.updatedAt)}</em>
              </span>
            )}
            <span className="ai-chat-tools">
              <button type="button" aria-label="Переименовать диалог" title="Переименовать" onClick={(event) => { event.stopPropagation(); onStartRename(chat.id, chat.title) }}><Pencil size={13} /></button>
              <button type="button" aria-label="Удалить диалог" title="Удалить" onClick={(event) => { event.stopPropagation(); onDelete(chat.id) }}><Trash2 size={13} /></button>
            </span>
          </div>
        )) : <p className="ai-chat-empty">Диалогов пока нет.<br />Задайте первый вопрос — он сохранится в этом браузере.</p>}
      </div>
      <div className="ai-sidebar-foot">
        <button type="button" className="ai-tour-button" onClick={() => startTour()}><GraduationCap size={15} /> Обучение по сайту</button>
        <p className="ai-sidebar-note"><Check size={12} /> Чаты хранятся только в вашем браузере</p>
      </div>
    </div>
  )
}

export default function AssistantChat() {
  const [mode, setMode] = useState('closed')
  const [chats, setChats] = useState(() => readChats())
  const [activeId, setActiveId] = useState(() => readActiveChatId())
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [connection, setConnection] = useState('checking')
  const [listOpen, setListOpen] = useState(false)
  const [renamingId, setRenamingId] = useState('')
  const [renameValue, setRenameValue] = useState('')
  const launcherRef = useRef(null)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)
  const formRef = useRef(null)
  const requestRef = useRef(null)
  const open = mode !== 'closed'

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeId) || null,
    [chats, activeId],
  )
  const messages = useMemo(() => activeChat?.messages || [], [activeChat])

  // Чаты переживают перезагрузку страницы: пишем их в localStorage после
  // каждого изменения и держим только диалоги с сообщениями.
  useEffect(() => {
    writeChats(chats.filter((chat) => chat.messages.length > 0))
  }, [chats])
  useEffect(() => {
    writeActiveChatId(activeChat ? activeChat.id : '')
  }, [activeChat])

  const ensureChat = useCallback(() => {
    const fresh = createChat()
    setChats((current) => upsertChat(current, fresh))
    setActiveId(fresh.id)
    return fresh
  }, [])

  // Активного диалога может не быть: первый заход, удаление или случай, когда
  // запомненный id указывал на пустой чат, который мы не сохраняли. Тогда
  // открываем самый свежий диалог, а если их нет — начинаем новый.
  useEffect(() => {
    if (activeChat || !open) return
    if (chats.length) setActiveId(chats[0].id)
    else ensureChat()
  }, [activeChat, chats, open, ensureChat])

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

  useEffect(() => onAssistantOpen((next) => {
    setMode(next)
    setListOpen(next === 'full')
  }), [])

  useEffect(() => onTourStart(() => {
    setMode('closed')
    setListOpen(false)
    requestRef.current?.abort()
  }), [])

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => inputRef.current?.focus(), 90)
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      if (mode === 'full') setMode('closed')
      else {
        setMode('closed')
        launcherRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, mode])

  useEffect(() => {
    if (!open || !scrollRef.current) return
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [open, messages, busy, activeId])

  useEffect(() => () => requestRef.current?.abort(), [])

  const appendMessage = useCallback((chatId, message) => {
    setChats((current) => {
      const index = current.findIndex((chat) => chat.id === chatId)
      const base = index >= 0 ? current[index] : createChat()
      const next = {
        ...base,
        id: chatId,
        messages: [...base.messages, message],
        updatedAt: new Date().toISOString(),
      }
      next.title = base.title && base.title !== EMPTY_CHAT_TITLE ? base.title : titleFromMessages(next.messages)
      return upsertChat(current, next)
    })
  }, [])

  const makeMessage = (role, content) => ({
    id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    at: new Date().toISOString(),
  })

  const sendMessage = async (rawText) => {
    const text = rawText.trim().slice(0, MAX_MESSAGE_LENGTH)
    if (!text || busy) return
    const chat = activeChat || ensureChat()
    const chatId = chat.id

    appendMessage(chatId, makeMessage('user', text))
    setDraft('')
    if (inputRef.current) inputRef.current.style.height = 'auto'

    // Команда-ключ: «Туторил» запускает обучение по сайту без обращения к ИИ.
    if (isTutorialCommand(text)) {
      appendMessage(chatId, makeMessage('assistant', TOUR_REPLY))
      window.setTimeout(() => startTour(), 260)
      return
    }

    setBusy(true)
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ messages: historyForModel([...(activeChat?.messages || []), makeMessage('user', text)]) }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        if (payload.code === 'not_configured') setConnection('not-configured')
        throw new Error(payload.code || 'request_failed')
      }
      if (typeof payload.reply !== 'string' || !payload.reply.trim()) throw new Error('empty_reply')
      appendMessage(chatId, makeMessage('assistant', payload.reply.trim()))
      setConnection('ready')
    } catch (error) {
      if (error.name !== 'AbortError') {
        const code = error.message || 'request_failed'
        if (!['not_configured', 'rate_limited', 'invalid_request', 'timeout'].includes(code)) setConnection('offline')
        appendMessage(chatId, makeMessage('assistant', errorCopy(code)))
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

  const startNewChat = () => {
    requestRef.current?.abort()
    requestRef.current = null
    setBusy(false)
    setDraft('')
    ensureChat()
    setRenamingId('')
    window.setTimeout(() => inputRef.current?.focus(), 40)
  }

  const selectChat = (id) => {
    requestRef.current?.abort()
    requestRef.current = null
    setBusy(false)
    setActiveId(id)
    setRenamingId('')
    // В плавающем окне список накладывается на переписку — убираем его.
    // В полноэкранном режиме это обычная боковая панель, она остаётся.
    if (mode === 'widget') setListOpen(false)
  }

  const deleteChat = (id) => {
    requestRef.current?.abort()
    requestRef.current = null
    setBusy(false)
    const rest = removeChat(chats, id)
    if (id === activeId) {
      const next = rest[0] || createChat()
      setChats(rest[0] ? rest : [next, ...rest])
      setActiveId(next.id)
    } else {
      setChats(rest)
    }
    setRenamingId('')
  }

  const commitRename = () => {
    if (!renamingId) return
    setChats((current) => renameChat(current, renamingId, renameValue))
    setRenamingId('')
  }

  const onDraftChange = (event) => {
    setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
    event.target.style.height = 'auto'
    event.target.style.height = `${Math.min(event.target.scrollHeight, 140)}px`
  }

  const conversation = (
    <>
      <div className="ai-conversation" ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions text">
        {messages.length === 0 ? <div className="ai-welcome">
          <span className="ai-welcome-glyph"><Bot size={26} strokeWidth={1.7} /></span>
          <span className="ai-eyebrow"><i /> ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ САЙТА</span>
          <h3>Привет!<br /><em>Я LOGOS AI.</em></h3>
          <p>Помогаю ориентироваться в путеводителе «Логос»: кабинеты, этажи, маршруты и возможности сайта. Меня создал Лисовой Данила, студент 1-го курса группы П-1.</p>
          <button type="button" className="ai-tour-card" onClick={() => startTour()}>
            <span className="ai-tour-card-icon"><GraduationCap size={17} /></span>
            <span className="ai-tour-card-copy">
              <strong>Обучение по сайту</strong>
              <small>Напишите команду «{TUTORIAL_COMMAND}» — покажу всё по шагам</small>
            </span>
            <ChevronRight size={17} />
          </button>
          <div className="ai-suggestions-label"><CircleHelp size={14} /> Например</div>
          <div className="ai-suggestions">
            {SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => void sendMessage(suggestion)} disabled={busy}>{suggestion}</button>)}
          </div>
          <div className="ai-honesty"><Sparkles size={13} /><span>Если точных данных на сайте нет, я так и скажу.</span></div>
        </div> : <div className="ai-message-list">
          {messages.map((message) => <article key={message.id} className={`ai-message ai-message-${message.role}`}>
            {message.role === 'assistant' && <span className="ai-message-avatar" aria-hidden="true"><Sparkles size={13} /></span>}
            <div className="ai-message-content"><MessageContent content={message.content} /></div>
          </article>)}
          {busy && <div className="ai-message ai-message-assistant ai-message-pending" aria-label="Помощник печатает">
            <span className="ai-message-avatar" aria-hidden="true"><Sparkles size={13} /></span>
            <div className="ai-typing"><i /><i /><i /><span>Думаю</span></div>
          </div>}
        </div>}
      </div>

      <div className="ai-composer-wrap">
        <form className="ai-composer" ref={formRef} onSubmit={submit}>
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
            placeholder={`Вопрос или команда «${TUTORIAL_COMMAND}»…`}
            maxLength={MAX_MESSAGE_LENGTH}
            disabled={busy}
          />
          <button className="ai-send" type="submit" disabled={busy || !draft.trim()} aria-label="Отправить сообщение" title="Отправить">
            {busy ? <LoaderCircle size={18} className="ai-send-loading" /> : <Send size={17} />}
          </button>
        </form>
        <div className="ai-composer-foot">
          <span><Check size={11} /> Чаты хранятся в браузере · ответы могут быть неточными</span>
          <span>{draft.length}/{MAX_MESSAGE_LENGTH}</span>
        </div>
      </div>
    </>
  )

  const topBar = (variant) => (
    <header className={`ai-topbar ai-topbar-${variant}`}>
      <div className="ai-topbar-identity">
        <BrandMark size={variant === 'full' ? 21 : 19} />
        <div className="ai-topbar-copy">
          <div className="ai-title-line"><h2>ЛОГОС <span>AI</span></h2><small>БЕТА</small></div>
          <div className={`ai-connection ai-connection-${connection}`}><i aria-hidden="true" />{connectionCopy(connection)}</div>
        </div>
      </div>
      <div className="ai-topbar-actions">
        {variant === 'full'
          ? <button type="button" className="ai-topbar-button" aria-label={listOpen ? 'Скрыть список диалогов' : 'Показать список диалогов'} title="Список диалогов" aria-pressed={listOpen} onClick={() => setListOpen((value) => !value)}><PanelLeft size={17} /></button>
          : <button type="button" className="ai-topbar-button" aria-label="Сохранённые диалоги" title="Сохранённые диалоги" onClick={() => setListOpen((value) => !value)}><History size={16} /></button>}
        <button type="button" className="ai-topbar-button" aria-label="Новый диалог" title="Новый диалог" onClick={startNewChat}><MessageSquarePlus size={16} /></button>
        {variant === 'widget' && <button type="button" className="ai-topbar-button" aria-label="Открыть на всю страницу" title="На всю страницу" onClick={() => { setMode('full'); setListOpen(true) }}><PanelLeft size={16} className="ai-expand-icon" /></button>}
        <button
          type="button"
          className="ai-topbar-button"
          aria-label={variant === 'full' ? 'Закрыть помощника' : 'Свернуть помощника'}
          title={variant === 'full' ? 'Закрыть' : 'Свернуть'}
          onClick={() => {
            setMode('closed')
            setListOpen(false)
            launcherRef.current?.focus()
          }}
        >
          <X size={18} />
        </button>
      </div>
    </header>
  )

  if (mode === 'full') {
    return (
      <div className="ai-full-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setMode('closed')}>
        <section className="ai-full" role="dialog" aria-modal="true" aria-labelledby="ai-full-title">
          <h2 id="ai-full-title" className="visually-hidden">LOGOS AI — помощник по сайту</h2>
          {listOpen && <ChatList
            chats={chats}
            activeId={activeId}
            onSelect={selectChat}
            onNew={startNewChat}
            onDelete={deleteChat}
            renamingId={renamingId}
            renameValue={renameValue}
            onRenameValue={setRenameValue}
            onStartRename={(id, title) => { setRenamingId(id); setRenameValue(title) }}
            onCommitRename={commitRename}
          />}
          <div className="ai-main">
            {topBar('full')}
            {conversation}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="assistant-widget">
      {open && <section id="assistant-panel" className={`assistant-panel ${listOpen ? 'assistant-panel-list' : ''}`} role="dialog" aria-modal="false" aria-labelledby="assistant-title">
        <h2 id="assistant-title" className="visually-hidden">LOGOS AI — помощник по сайту</h2>
        {listOpen && <div className="ai-widget-list">
          <ChatList
            chats={chats}
            activeId={activeId}
            onSelect={selectChat}
            onNew={startNewChat}
            onDelete={deleteChat}
            renamingId={renamingId}
            renameValue={renameValue}
            onRenameValue={setRenameValue}
            onStartRename={(id, title) => { setRenamingId(id); setRenameValue(title) }}
            onCommitRename={commitRename}
          />
        </div>}
        {topBar('widget')}
        {conversation}
      </section>}

      <button
        type="button"
        className={`assistant-launcher ${open ? 'assistant-launcher-open' : ''}`}
        ref={launcherRef}
        aria-expanded={open}
        aria-controls="assistant-panel"
        onClick={() => setMode((current) => (current === 'closed' ? 'widget' : 'closed'))}
      >
        <span className="assistant-launcher-icon"><MessageCircle size={19} /><i><Sparkles size={9} /></i></span>
        <span className="assistant-launcher-copy"><strong>{open ? 'Свернуть помощника' : 'LOGOS AI'}</strong><small>{open ? 'Чат открыт' : 'Помощник по сайту'}</small></span>
        <span className="assistant-launcher-beta">AI</span>
      </button>
    </div>
  )
}
