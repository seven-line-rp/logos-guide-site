import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowUp, Bot, Brain, Check, ChevronDown, Code, Copy, Download, GraduationCap, ImagePlus, Lightbulb, MapPin, Mic, MicOff, PanelLeft, RefreshCw, Route, Square, SquarePen, Trash2, TriangleAlert, Volume2, VolumeX, X } from 'lucide-react'
import { answerActions, askAgent, routeFromLink, chatTitle, chatToMarkdown, compressImage, containsProfanity, createChat, loadChats, maskProfanity, MAX_IMAGES, MAX_INPUT, plainText, saveChats } from '../ai-chat.js'
import { functionalStorageAllowed, onConsentChange } from '../consent.js'
import { speakText, stopSpeech } from '../speech.js'
import { AiMessageText, RawText, messageSubject } from '../components/ai-message.js'
import RoutePreview from '../components/RoutePreview.jsx'
import { rooms } from '../data.js'

// ЛОГОС AI: чат с DeepSeek через public/api/ai-chat.php. Чаты хранятся в
// localStorage (ключ logos-ai-chats, если человек не отказался от
// функциональных cookie), картинки сжимаются в браузере. Мат уходит в модель
// замаскированным. Практические задания (блок quiz рисует components/ai-quiz.js) и
// вопросы-продолжения под ответами (блок next) приходят прямо в ответе модели.


const suggestions = [
  { icon: GraduationCap, text: 'Как решать химические реакции?' },
  { icon: MapPin, text: 'Где библиотека и как до неё дойти?' },
  { icon: GraduationCap, text: 'Какие специальности есть в колледже?' },
  { icon: Lightbulb, text: 'Объясни закон Ома на простом примере' },
  { icon: Code, text: 'Помоги разобраться с циклами в Python' },
]

const thinkingStages = {
  normal: ['Читаю вопрос', 'Ищу в плане корпуса', 'Сверяюсь с колледжлогос.рф', 'Собираю ответ'],
  deep: ['Размышляю над вопросом', 'Перебираю варианты', 'Проверяю себя', 'Собираю подробный ответ'],
  image: ['Рассматриваю картинку', 'Ищу важное на снимке', 'Связываю с планом корпуса', 'Собираю ответ'],
}

function Thinking({ deep, image }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const stages = thinkingStages[image ? 'image' : deep ? 'deep' : 'normal']
  const stage = Math.min(stages.length - 1, Math.floor(tick / (deep ? 3 : 2)))
  return <div className={`ai-thinking ${deep ? 'ai-thinking-deep' : ''}`} role="status">
    <span className="ai-thinking-orb" aria-hidden="true"><Bot size={14} /></span>
    <strong key={stage} className="ai-thinking-label">{stages[stage]}</strong>
    <small>{`${Math.floor(tick / 60)}:${String(tick % 60).padStart(2, '0')}`}</small>
  </div>
}

function Reasoning({ text }) {
  const [open, setOpen] = useState(false)
  return <div className="ai-reasoning">
    <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}><Brain size={14} /> Ход мыслей <ChevronDown size={14} className={open ? 'is-open' : ''} /></button>
    {open && <div className="ai-reasoning-body"><AiMessageText text={text} plain /></div>}
  </div>
}

function MessageTools({ message, onRegenerate }) {
  const [copied, setCopied] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  useEffect(() => () => { if (speaking) stopSpeech() }, [speaking])
  const copy = async () => {
    try { await navigator.clipboard.writeText(plainText(message.content)); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { /* буфер недоступен */ }
  }
  const speak = async () => {
    if (speaking) { stopSpeech(); setSpeaking(false); return }
    setSpeaking(true)
    await speakText(plainText(message.content)).catch(() => {})
    setSpeaking(false)
  }
  return <div className="ai-tools">
    <button type="button" onClick={copy} title="Скопировать ответ" aria-label="Скопировать ответ">{copied ? <Check size={14} /> : <Copy size={14} />}</button>
    {'speechSynthesis' in window && <button type="button" onClick={speak} title={speaking ? 'Остановить озвучку' : 'Озвучить ответ'} aria-label={speaking ? 'Остановить озвучку' : 'Озвучить ответ'}>{speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}</button>}
    {onRegenerate && <button type="button" onClick={onRegenerate} title="Ответить заново" aria-label="Ответить заново"><RefreshCw size={14} /></button>}
  </div>
}

function formatWhen(time) {
  const date = new Date(time)
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

// На узком экране список чатов — выезжающая панель. Её рендерим в body:
// у main анимация появления с transform, и position: fixed внутри неё
// считался бы от main, а не от окна.
const narrowQuery = '(max-width: 900px)'
const subscribeNarrow = (listener) => { const query = window.matchMedia(narrowQuery); query.addEventListener('change', listener); return () => query.removeEventListener('change', listener) }
const useNarrow = () => useSyncExternalStore(subscribeNarrow, () => window.matchMedia(narrowQuery).matches, () => false)

const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

export default function AiAgentPage() {
  const [store, setStore] = useState(() => {
    const saved = loadChats()
    const fresh = createChat()
    return { chats: [fresh, ...saved.chats], activeId: fresh.id }
  })
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState([])
  const [pending, setPending] = useState(null)
  const [deep, setDeep] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState('')
  // Сколько вопросов осталось сегодня — сервер сообщает с каждым ответом.
  const [left, setLeft] = useState(null)
  const [listening, setListening] = useState(false)
  const [saving, setSaving] = useState(() => functionalStorageAllowed())
  const [confirmDelete, setConfirmDelete] = useState('')
  const narrow = useNarrow()
  const controller = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const recognition = useRef(null)

  const { chats, activeId } = store
  const chat = chats.find((item) => item.id === activeId) || chats[0]
  const messages = chat.messages
  const history = useMemo(() => [...chats].filter((item) => item.messages.length).sort((a, b) => b.updated - a.updated), [chats])

  useEffect(() => onConsentChange((consent) => setSaving(consent.functional)), [])
  useEffect(() => {
    const result = saveChats(chats, activeId)
    if (result === 'trimmed') setNotice('Память браузера почти заполнена: из старых чатов убраны картинки.')
    if (result === 'full') setNotice('Память браузера заполнена. Удалите старые чаты, чтобы сохранять новые.')
  }, [chats, activeId, saving])
  useEffect(() => () => { controller.current?.abort(); recognition.current?.abort?.(); stopSpeech() }, [])
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages.length, pending, activeId])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 5000)
    return () => window.clearTimeout(timer)
  }, [notice])

  const updateChat = useCallback((id, change) => {
    setStore((current) => ({ ...current, chats: current.chats.map((item) => item.id === id ? { ...change(item), updated: Date.now() } : item) }))
  }, [])

  const run = async (chatId, next, useDeep) => {
    setPending({ chatId, deep: useDeep, image: Boolean(next[next.length - 1]?.images?.length) })
    controller.current = new AbortController()
    try {
      const answer = await askAgent(next, { signal: controller.current.signal, deep: useDeep })
      if (!answer.vision) setNotice('Модель пока не видит картинки, поэтому отвечает по тексту вопроса.')
      if (answer.left !== null) setLeft(answer.left)
      updateChat(chatId, (item) => ({ ...item, messages: [...item.messages, { role: 'assistant', content: answer.reply, sig: answer.sig || undefined, reasoning: answer.reasoning || undefined, at: Date.now() }] }))
    } catch (error) {
      if (error.left !== null && error.left !== undefined) setLeft(error.left)
      if (error.name !== 'AbortError') updateChat(chatId, (item) => ({ ...item, messages: [...item.messages, { role: 'assistant', content: error.message, error: true, at: Date.now() }] }))
    } finally {
      controller.current = null
      setPending(null)
    }
  }

  const send = async (text = input) => {
    const content = text.trim().slice(0, MAX_INPUT)
    if ((!content && !attachments.length) || pending) return
    const chatId = chat.id
    const userMessage = { role: 'user', content: containsProfanity(content) ? maskProfanity(content) : content, at: Date.now(), ...(attachments.length ? { images: attachments } : {}) }
    const next = [...messages.filter((m) => !m.error), userMessage]
    updateChat(chatId, (item) => ({ ...item, title: item.messages.length ? item.title : chatTitle(userMessage.content), messages: next }))
    setInput('')
    setAttachments([])
    inputRef.current?.focus()
    await run(chatId, next, deep)
  }

  // «Спросить про это место» с карты и маршрута: /ai?about=<id> сразу задаёт
  // вопрос в новом чате; /ai?q=<текст> — любой вопрос.
  const [params, setParams] = useSearchParams()
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    const room = rooms.find((item) => item.id === params.get('about'))
    const question = room
      ? `Расскажи про «${room.name}${room.number ? ` №${room.number}` : ''}» (${room.floor} этаж): что это за место, что там бывает и как туда пройти от главного входа.`
      : (params.get('q') || '').slice(0, MAX_INPUT)
    if (!question) return
    asked.current = true
    setParams({}, { replace: true })
    send(question)
    // Вопрос задаётся один раз при открытии страницы.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const regenerate = () => {
    const lastUser = messages.findLastIndex((message) => message.role === 'user')
    if (lastUser < 0 || pending) return
    const next = messages.slice(0, lastUser + 1)
    updateChat(chat.id, (item) => ({ ...item, messages: next }))
    run(chat.id, next, deep)
  }

  const stop = () => controller.current?.abort()
  const newChat = () => {
    stop()
    setStore((current) => {
      const empty = current.chats.find((item) => !item.messages.length)
      if (empty) return { ...current, activeId: empty.id }
      const fresh = createChat()
      return { chats: [fresh, ...current.chats], activeId: fresh.id }
    })
    setSidebar(false)
    setInput('')
    setAttachments([])
    inputRef.current?.focus()
  }
  const openChat = (id) => { if (pending) stop(); setStore((current) => ({ ...current, activeId: id })); setSidebar(false); setConfirmDelete('') }
  const removeChat = (id) => {
    if (confirmDelete !== id) { setConfirmDelete(id); return }
    setConfirmDelete('')
    setStore((current) => {
      const rest = current.chats.filter((item) => item.id !== id)
      if (current.activeId !== id && rest.length) return { ...current, chats: rest }
      const fresh = rest.find((item) => !item.messages.length) || createChat()
      return { chats: rest.includes(fresh) ? rest : [fresh, ...rest], activeId: fresh.id }
    })
  }
  const exportChat = () => {
    const blob = new Blob([chatToMarkdown(chat)], { type: 'text/markdown;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `logos-ai-${new Date(chat.created).toISOString().slice(0, 10)}.md`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const addFiles = async (files) => {
    const images = [...files].filter((file) => file.type.startsWith('image/'))
    if (!images.length) return
    const room = MAX_IMAGES - attachments.length
    if (room <= 0) { setNotice(`Можно приложить до ${MAX_IMAGES} картинок.`); return }
    if (images.length > room) setNotice(`Можно приложить до ${MAX_IMAGES} картинок. Лишние пропущены.`)
    const added = []
    for (const file of images.slice(0, room)) {
      try { added.push(await compressImage(file)) } catch (error) { setNotice(error.message) }
    }
    setAttachments((current) => [...current, ...added].slice(0, MAX_IMAGES))
    inputRef.current?.focus()
  }

  const toggleVoice = () => {
    if (listening) { recognition.current?.stop(); return }
    const recognizer = new SpeechRecognition()
    recognizer.lang = 'ru-RU'
    recognizer.interimResults = true
    const start = input ? `${input.trim()} ` : ''
    recognizer.onresult = (event) => setInput(start + [...event.results].map((result) => result[0].transcript).join(''))
    recognizer.onend = () => { setListening(false); inputRef.current?.focus() }
    recognizer.onerror = () => { setListening(false); setNotice('Не удалось распознать речь. Проверьте доступ к микрофону.') }
    recognition.current = recognizer
    setListening(true)
    recognizer.start()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() }
  }
  const onPaste = (event) => {
    const files = [...(event.clipboardData?.files || [])]
    if (files.some((file) => file.type.startsWith('image/'))) { event.preventDefault(); addFiles(files) }
  }
  const onDrop = (event) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files) }

  const sidebarView = <>
    <aside className="ai-sidebar" aria-label="Чаты">
      <div className="ai-sidebar-top">
        <span className="ai-brand"><span className="ai-mark" aria-hidden="true"><Bot size={14} /></span>ЛОГОС AI<span className="nav-badge">АЛЬФА</span></span>
        <button className="ai-icon" type="button" onClick={() => (narrow ? setSidebar(false) : setCollapsed(true))} aria-label="Скрыть список чатов" title="Скрыть"><PanelLeft size={18} /></button>
      </div>
      <button className="ai-new" type="button" onClick={newChat}><SquarePen size={16} /> Новый чат</button>
      <div className="ai-history">
        {history.length > 0 && <span className="ai-history-label">Недавние</span>}
        {history.length ? history.map((item) => <div key={item.id} className={`ai-history-item ${item.id === chat.id ? 'is-active' : ''}`}>
          <button type="button" className="ai-history-open" onClick={() => openChat(item.id)} title={formatWhen(item.updated)}><RawText text={item.title} /></button>
          <button type="button" className={`ai-history-delete ${confirmDelete === item.id ? 'is-confirm' : ''}`} onClick={() => removeChat(item.id)} title={confirmDelete === item.id ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить чат'} aria-label={confirmDelete === item.id ? 'Подтвердить удаление' : 'Удалить чат'}>{confirmDelete === item.id ? <Check size={14} /> : <Trash2 size={14} />}</button>
        </div>) : <div className="ai-history-empty">Здесь появятся ваши разговоры.</div>}
      </div>
      <div className="ai-sidebar-note">{saving ? 'Чаты хранятся только в этом браузере.' : 'Чаты не сохраняются: вы отказались от функциональных cookie.'}</div>
    </aside>
    {sidebar && <button type="button" className="ai-sidebar-scrim" onClick={() => setSidebar(false)} aria-hidden="true" tabIndex={-1} />}
  </>

  const busyHere = pending?.chatId === chat.id
  const lastAssistant = messages.findLastIndex((message) => message.role === 'assistant')

  const composer = <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); send() }}>
    {attachments.length > 0 && <div className="ai-attachments">{attachments.map((src, index) => <span key={index} className="ai-attachment"><img src={src} alt={`Картинка ${index + 1}`} /><button type="button" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))} aria-label="Убрать картинку"><X size={12} /></button></span>)}</div>}
    <label className="visually-hidden" htmlFor="ai-input">Сообщение для ЛОГОС AI</label>
    <textarea id="ai-input" ref={inputRef} rows={1} value={input} maxLength={MAX_INPUT} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} placeholder={listening ? 'Говорите…' : 'Спросите что-нибудь…'} />
    <div className="ai-composer-bar">
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
      <button className="ai-icon" type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_IMAGES} title="Приложить картинку (можно вставить Ctrl+V или перетащить)" aria-label="Приложить картинку"><ImagePlus size={18} /></button>
      <button type="button" className={`ai-deep ${deep ? 'is-on' : ''}`} onClick={() => setDeep((value) => !value)} aria-pressed={deep} title="Модель рассуждает дольше, но точнее: для сложных вопросов и задач"><Brain size={15} /><span>Подумать глубже</span></button>
      <span className="ai-composer-gap" />
      {SpeechRecognition && <button className={`ai-icon ${listening ? 'is-listening' : ''}`} type="button" onClick={toggleVoice} title={listening ? 'Остановить запись' : 'Сказать голосом'} aria-label={listening ? 'Остановить запись' : 'Сказать голосом'}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
      {busyHere
        ? <button className="ai-send" type="button" onClick={stop} aria-label="Остановить ответ" title="Остановить"><Square size={13} fill="currentColor" /></button>
        : <button className="ai-send" type="submit" disabled={(!input.trim() && !attachments.length) || Boolean(pending)} aria-label="Отправить" title="Отправить (Enter)"><ArrowUp size={18} /></button>}
    </div>
  </form>

  return <section className={`ai-page ${collapsed ? 'ai-collapsed' : ''}`}>
    {narrow ? createPortal(<div className={`ai-drawer ${sidebar ? 'ai-sidebar-open' : ''}`}>{sidebarView}</div>, document.body) : !collapsed && sidebarView}

    <div className={`ai-main ${dragging ? 'is-dragging' : ''} ${messages.length ? '' : 'is-empty'}`} onDragOver={(event) => { if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); setDragging(true) } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={onDrop}>
      <div className="ai-topbar">
        {(narrow || collapsed) && <button className="ai-icon" type="button" onClick={() => (narrow ? setSidebar(true) : setCollapsed(false))} aria-label="Открыть список чатов" title="Чаты"><PanelLeft size={18} /></button>}
        {(narrow || collapsed) && <button className="ai-icon" type="button" onClick={newChat} aria-label="Новый чат" title="Новый чат"><SquarePen size={17} /></button>}
        <span className="ai-topbar-title">{messages.length ? <RawText text={chat.title} /> : ''}</span>
        {messages.length > 0 && <button className="ai-icon" type="button" onClick={exportChat} title="Скачать чат (.md)" aria-label="Скачать чат"><Download size={17} /></button>}
      </div>

      <div className="ai-scroll" ref={listRef} role="log" aria-live="polite" aria-label="Сообщения">
        {!messages.length ? <div className="ai-welcome">
          <span className="ai-mark ai-mark-big" aria-hidden="true"><Bot size={22} /></span>
          <h1>Чем помочь?</h1>
          <p>Спросите о чём угодно: найду кабинет и построю маршрут, расскажу о колледже, решу задачу, объясню тему, помогу с кодом или текстом.</p>
          {composer}
          <div className="ai-suggestions">{suggestions.map(({ icon: Icon, text }) => <button key={text} type="button" onClick={() => send(text)}><Icon size={15} />{text}</button>)}</div>
        </div> : <div className="ai-thread">
          {messages.map((message, index) => {
            if (message.role === 'user') return <div key={index} className="ai-message ai-message-user">{message.images?.length > 0 && <div className="ai-user-images">{message.images.map((src, i) => <img key={i} src={src} alt="Приложенная картинка" />)}</div>}{message.content && <div className="ai-bubble"><AiMessageText text={message.content} plain /></div>}</div>
            const actions = message.error ? [] : answerActions(message.content)
            const routeLink = actions.find((action) => action.kind === 'route')
            const preview = routeLink ? routeFromLink(routeLink.href) : null
            return <div key={index} className={`ai-message ai-message-assistant ${message.error ? 'ai-message-error' : ''}`}>
              {message.reasoning && <Reasoning text={message.reasoning} />}
              <div className={`ai-text${messageSubject(message.content) ? ` ai-subject ai-subject-${messageSubject(message.content)}` : ''}`}>{message.error && <TriangleAlert size={16} className="ai-error-icon" />}<AiMessageText text={message.content} onAsk={index === lastAssistant && !pending && !message.error ? (question) => send(question) : undefined} /></div>
              {message.error && index === messages.length - 1 && <button type="button" className="ai-chip" onClick={regenerate}>Повторить</button>}
              {preview && <RoutePreview {...preview} live={index === lastAssistant} />}
              {actions.length > 0 && <div className="ai-actions">{actions.map((action) => <Link key={action.href} to={action.href} className="ai-chip">{action.kind === 'route' ? <Route size={14} /> : <MapPin size={14} />}<RawText text={action.label} /></Link>)}</div>}
              {!message.error && <MessageTools message={message} onRegenerate={index === lastAssistant && !pending ? regenerate : null} />}
            </div>
          })}
          {busyHere && <div className="ai-message ai-message-assistant"><Thinking deep={pending.deep} image={pending.image} /></div>}
        </div>}
      </div>

      {dragging && <div className="ai-drop" aria-hidden="true"><ImagePlus size={26} /><strong>Отпустите, чтобы приложить картинку</strong></div>}
      {messages.length > 0 && <div className="ai-dock">
        {notice && <div className="ai-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Закрыть"><X size={14} /></button></div>}
        {composer}
      </div>}
      {!messages.length && notice && <div className="ai-dock"><div className="ai-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Закрыть"><X size={14} /></button></div></div>}
      <div className="ai-disclaimer">{left !== null && <span className={`ai-left ${left <= 2 ? 'is-low' : ''}`}>{left > 0 ? `Осталось вопросов сегодня: ${left}` : 'Вопросы на сегодня закончились'}</span>}ЛОГОС AI может ошибаться, важное уточняйте в колледже. <Link to="/privacy#ai">Конфиденциальность</Link></div>
    </div>
  </section>
}
