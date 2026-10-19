import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Brain, Check, ChevronDown, Copy, Download, GraduationCap, ImagePlus, Lightbulb, MapPin, Mic, MicOff, PanelLeft, Plus, RefreshCw, Route, SendHorizontal, Sparkles, Square, Trash2, TriangleAlert, UserRound, Volume2, VolumeX, X } from 'lucide-react'
import { answerActions, askAgent, chatTitle, chatToMarkdown, compressImage, containsProfanity, createChat, loadChats, maskProfanity, MAX_IMAGES, MAX_INPUT, plainText, saveChats } from '../ai-chat.js'
import { functionalStorageAllowed, onConsentChange } from '../consent.js'
import { speakText, stopSpeech } from '../speech.js'
import { AiMessageText, RawText } from '../components/ai-message.js'

// ЛОГОС AI: чат с DeepSeek через public/api/ai-chat.php. Чаты хранятся в
// localStorage (ключ logos-ai-chats, если человек не отказался от
// функциональных cookie), картинки сжимаются в браузере. Мат не уходит в
// модель — вместо ответа шуточная «отправка куратору».

const promptGroups = [
  { icon: MapPin, title: 'Найти место', items: ['Где библиотека и как до неё дойти?', 'Как пройти от входа до кабинета 211?', 'Где ближайший туалет на втором этаже?'] },
  { icon: GraduationCap, title: 'О колледже', items: ['Какие специальности есть в колледже?', 'Что нужно для поступления?', 'Расскажи о колледже «Логос»'] },
  { icon: Lightbulb, title: 'Учёба и помощь', items: ['Как пользоваться маршрутом на сайте?', 'Объясни простыми словами, что такое IP-адрес', 'Составь план подготовки к зачёту на неделю'] },
]

const thinkingStages = {
  normal: ['Читаю вопрос', 'Ищу в плане корпуса', 'Сверяюсь с колледжлогос.рф', 'Собираю ответ'],
  deep: ['Размышляю над вопросом', 'Перебираю варианты', 'Проверяю себя', 'Собираю подробный ответ'],
  image: ['Рассматриваю картинку', 'Ищу важное на снимке', 'Связываю с планом корпуса', 'Собираю ответ'],
}

const curatorStages = ['Упаковываем сообщение…', 'Отправляем куратору…', 'Куратор читает…', 'Доставлено куратору']

function Thinking({ deep, image }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const stages = thinkingStages[image ? 'image' : deep ? 'deep' : 'normal']
  const stage = Math.min(stages.length - 1, Math.floor(tick / (deep ? 3 : 2)))
  return <div className={`ai-thinking ${deep ? 'ai-thinking-deep' : ''}`} role="status">
    <span className="ai-thinking-orb" aria-hidden="true"><Sparkles size={15} /></span>
    <span className="ai-thinking-copy">
      <strong key={stage} className="ai-thinking-label">{stages[stage]}</strong>
      <small>{deep ? 'Режим «Подумать глубже»' : 'ЛОГОС AI думает'} · {`${Math.floor(tick / 60)}:${String(tick % 60).padStart(2, '0')}`}</small>
    </span>
    <span className="ai-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
  </div>
}

function CuratorCard({ animate }) {
  const [stage, setStage] = useState(animate ? 0 : curatorStages.length - 1)
  useEffect(() => {
    if (!animate) return undefined
    const timers = [900, 1900, 2900].map((delay, index) => window.setTimeout(() => setStage(index + 1), delay))
    return () => timers.forEach(window.clearTimeout)
  }, [animate])
  const done = stage === curatorStages.length - 1
  const ref = useRef(null)
  // Шутка появляется в конце анимации: докручиваем чат, чтобы её было видно.
  useEffect(() => { if (animate && done) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [animate, done])
  return <div ref={ref} className={`ai-curator ${done ? 'ai-curator-done' : ''}`} role="status">
    <div className="ai-curator-track" aria-hidden="true">
      <span className="ai-curator-node"><UserRound size={15} /></span>
      <span className="ai-curator-line"><span className="ai-curator-letter" style={{ '--stage': stage }}>✉</span></span>
      <span className="ai-curator-node ai-curator-target">{done ? <Check size={15} /> : <GraduationCap size={15} />}</span>
    </div>
    <strong>{curatorStages[stage]}</strong>
    <div className="ai-curator-progress" aria-hidden="true"><span style={{ width: `${(stage + 1) * 25}%` }} /></div>
    {done && <p className="ai-curator-joke">Шутка 🙂 Никуда ничего не ушло. Но давайте без мата — так я помогу быстрее. Переформулируйте вопрос, и продолжим.</p>}
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
  const [dragging, setDragging] = useState(false)
  const [notice, setNotice] = useState('')
  const [listening, setListening] = useState(false)
  const [saving, setSaving] = useState(() => functionalStorageAllowed())
  const [confirmDelete, setConfirmDelete] = useState('')
  const narrow = useNarrow()
  const controller = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)
  const fileRef = useRef(null)
  const recognition = useRef(null)
  const mountedAt = useRef(Date.now())

  const { chats, activeId } = store
  const chat = chats.find((item) => item.id === activeId) || chats[0]
  const messages = chat.messages
  const history = useMemo(() => [...chats].filter((item) => item.messages.length).sort((a, b) => b.updated - a.updated), [chats])

  useEffect(() => onConsentChange((consent) => setSaving(consent.functional)), [])
  useEffect(() => {
    const result = saveChats(chats, activeId)
    if (result === 'trimmed') setNotice('Память браузера почти заполнена: из старых чатов убраны картинки.')
    if (result === 'full') setNotice('Память браузера заполнена — удалите старые чаты, чтобы сохранять новые.')
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
      if (!answer.vision) setNotice('Модель пока не видит картинки — ответ по тексту вопроса.')
      updateChat(chatId, (item) => ({ ...item, messages: [...item.messages, { role: 'assistant', content: answer.reply, reasoning: answer.reasoning || undefined, at: Date.now() }] }))
    } catch (error) {
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
    const rude = containsProfanity(content)
    const userMessage = { role: 'user', content: rude ? maskProfanity(content) : content, at: Date.now(), ...(attachments.length && !rude ? { images: attachments } : {}) }
    const next = [...messages.filter((m) => !m.error), userMessage]
    updateChat(chatId, (item) => ({ ...item, title: item.messages.length ? item.title : chatTitle(userMessage.content), messages: rude ? [...item.messages, userMessage, { role: 'curator', content: 'Сообщение передано куратору', at: Date.now() }] : next }))
    setInput('')
    setAttachments([])
    inputRef.current?.focus()
    if (!rude) await run(chatId, next, deep)
  }

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
    if (images.length > room) setNotice(`Можно приложить до ${MAX_IMAGES} картинок — лишние пропущены.`)
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
        <button className="ai-new" type="button" onClick={newChat}><Plus size={16} /> Новый чат</button>
        <button className="ai-sidebar-close icon-button" type="button" onClick={() => setSidebar(false)} aria-label="Закрыть список чатов"><X size={18} /></button>
      </div>
      <div className="ai-history">
        {history.length ? history.map((item) => <div key={item.id} className={`ai-history-item ${item.id === chat.id ? 'is-active' : ''}`}>
          <button type="button" className="ai-history-open" onClick={() => openChat(item.id)}><span><RawText text={item.title} /></span><small>{formatWhen(item.updated)} · {item.messages.filter((m) => m.role === 'user').length} вопр.</small></button>
          <button type="button" className={`ai-history-delete ${confirmDelete === item.id ? 'is-confirm' : ''}`} onClick={() => removeChat(item.id)} title={confirmDelete === item.id ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить чат'} aria-label={confirmDelete === item.id ? 'Подтвердить удаление' : 'Удалить чат'}>{confirmDelete === item.id ? <Check size={14} /> : <Trash2 size={14} />}</button>
        </div>) : <p className="ai-history-empty">Здесь появятся ваши разговоры.</p>}
      </div>
      <p className="ai-sidebar-note">{saving ? 'Чаты хранятся только в этом браузере.' : 'Чаты не сохраняются: вы отказались от функциональных cookie.'}</p>
    </aside>
    {sidebar && <button type="button" className="ai-sidebar-scrim" onClick={() => setSidebar(false)} aria-hidden="true" tabIndex={-1} />}
  </>

  const busyHere = pending?.chatId === chat.id
  const lastAssistant = messages.findLastIndex((message) => message.role === 'assistant')

  return <section className="ai-page container">
    <header className="ai-head">
      <span className="eyebrow"><i className="eyebrow-dot" />ЛОГОС AI · ТЕСТОВЫЙ РЕЖИМ</span>
      <h1>Спросите <em>путеводитель.</em></h1>
      <p>Знает план корпуса, разделы сайта и материалы с <a href="https://колледжлогос.рф" target="_blank" rel="noopener noreferrer">колледжлогос.рф</a>. Понимает картинки, строит маршруты и помогает с учёбой. Отвечает нейросеть DeepSeek — она может ошибаться, важное уточняйте в колледже.</p>
    </header>

    <div className={`ai-layout ${sidebar ? 'ai-sidebar-open' : ''}`}>
      {narrow ? createPortal(<div className={`ai-drawer ${sidebar ? 'ai-sidebar-open' : ''}`}>{sidebarView}</div>, document.body) : sidebarView}

      <div className={`ai-chat ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { if ([...event.dataTransfer.types].includes('Files')) { event.preventDefault(); setDragging(true) } }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false) }} onDrop={onDrop}>
        <div className="ai-chat-top">
          <button className="ai-sidebar-toggle icon-button" type="button" onClick={() => setSidebar(true)} aria-label="Открыть список чатов" title="Чаты"><PanelLeft size={18} /></button>
          <span className="ai-chat-title"><span className="ai-avatar ai-avatar-brand"><Sparkles size={16} /></span><span><strong>ЛОГОС AI</strong><small>{busyHere ? 'думает…' : 'на связи'}</small></span><span className="nav-badge">ТЕСТ</span></span>
          <span className="ai-chat-actions">
            <button className="ai-reset" type="button" onClick={exportChat} disabled={!messages.length} title="Скачать чат (.md)"><Download size={15} /><span>Скачать</span></button>
            <button className="ai-reset" type="button" onClick={newChat} disabled={!messages.length} title="Начать новый разговор"><Plus size={15} /><span>Новый чат</span></button>
          </span>
        </div>

        <div className="ai-messages" ref={listRef} role="log" aria-live="polite" aria-label="Сообщения">
          <div className="ai-message ai-message-assistant"><span className="ai-avatar ai-avatar-brand" aria-hidden="true"><Sparkles size={14} /></span><div className="ai-bubble"><p>Привет! Я ЛОГОС AI. Подскажу, где кабинет, и построю маршрут, расскажу о сайте и о колледже, разберу фото расписания или объявления, помогу с учёбой. Можно и просто поболтать.</p></div></div>
          {!messages.length && <div className="ai-prompts">{promptGroups.map((group) => { const Icon = group.icon; return <div key={group.title} className="ai-prompt-group"><span className="ai-prompt-title"><Icon size={15} />{group.title}</span>{group.items.map((text) => <button key={text} type="button" onClick={() => send(text)}>{text}</button>)}</div> })}</div>}
          {messages.map((message, index) => {
            if (message.role === 'curator') return <div key={index} className="ai-message ai-message-assistant"><span className="ai-avatar ai-avatar-curator" aria-hidden="true"><GraduationCap size={14} /></span><CuratorCard animate={message.at > mountedAt.current} /></div>
            if (message.role === 'user') return <div key={index} className="ai-message ai-message-user"><div className="ai-bubble">{message.images?.length > 0 && <div className="ai-bubble-images">{message.images.map((src, i) => <img key={i} src={src} alt="Приложенная картинка" />)}</div>}{message.content && <AiMessageText text={message.content} plain />}</div></div>
            const actions = message.error ? [] : answerActions(message.content)
            return <div key={index} className={`ai-message ai-message-assistant ${message.error ? 'ai-message-error' : ''}`}>
              <span className={`ai-avatar ${message.error ? '' : 'ai-avatar-brand'}`} aria-hidden="true">{message.error ? <TriangleAlert size={14} /> : <Sparkles size={14} />}</span>
              <div className="ai-answer">
                {message.reasoning && <Reasoning text={message.reasoning} />}
                <div className="ai-bubble"><AiMessageText text={message.content} />{message.error && index === messages.length - 1 && <button type="button" className="ai-retry" onClick={regenerate}>Повторить</button>}</div>
                {actions.length > 0 && <div className="ai-actions">{actions.map((action) => <Link key={action.href} to={action.href} className={`ai-action ai-action-${action.kind}`}>{action.kind === 'route' ? <Route size={14} /> : <MapPin size={14} />}<RawText text={action.label} /></Link>)}</div>}
                {!message.error && <MessageTools message={message} onRegenerate={index === lastAssistant && !pending ? regenerate : null} />}
              </div>
            </div>
          })}
          {busyHere && <div className="ai-message ai-message-assistant"><span className="ai-avatar ai-avatar-brand ai-avatar-pulse" aria-hidden="true"><Sparkles size={14} /></span><Thinking deep={pending.deep} image={pending.image} /></div>}
        </div>

        {dragging && <div className="ai-drop" aria-hidden="true"><ImagePlus size={28} /><strong>Отпустите, чтобы приложить картинку</strong></div>}
        {notice && <div className="ai-notice" role="status"><span>{notice}</span><button type="button" onClick={() => setNotice('')} aria-label="Закрыть"><X size={14} /></button></div>}

        <form className="ai-composer-wrap" onSubmit={(event) => { event.preventDefault(); send() }}>
          {attachments.length > 0 && <div className="ai-attachments">{attachments.map((src, index) => <span key={index} className="ai-attachment"><img src={src} alt={`Картинка ${index + 1}`} /><button type="button" onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))} aria-label="Убрать картинку"><X size={12} /></button></span>)}</div>}
          <div className="ai-composer">
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = '' }} />
            <button className="ai-tool-button" type="button" onClick={() => fileRef.current?.click()} disabled={attachments.length >= MAX_IMAGES} title="Приложить картинку (можно вставить Ctrl+V или перетащить)" aria-label="Приложить картинку"><ImagePlus size={18} /></button>
            <label className="visually-hidden" htmlFor="ai-input">Сообщение для ЛОГОС AI</label>
            <textarea id="ai-input" ref={inputRef} rows={1} value={input} maxLength={MAX_INPUT} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} placeholder={listening ? 'Говорите…' : 'Спросите о кабинете, сайте или колледже…'} />
            {SpeechRecognition && <button className={`ai-tool-button ${listening ? 'is-listening' : ''}`} type="button" onClick={toggleVoice} title={listening ? 'Остановить запись' : 'Сказать голосом'} aria-label={listening ? 'Остановить запись' : 'Сказать голосом'}>{listening ? <MicOff size={18} /> : <Mic size={18} />}</button>}
            {busyHere
              ? <button className="ai-send" type="button" onClick={stop} aria-label="Остановить ответ" title="Остановить"><Square size={15} /></button>
              : <button className="ai-send" type="submit" disabled={(!input.trim() && !attachments.length) || Boolean(pending)} aria-label="Отправить" title="Отправить (Enter)"><SendHorizontal size={17} /></button>}
          </div>
          <div className="ai-composer-foot">
            <button type="button" className={`ai-deep ${deep ? 'is-on' : ''}`} onClick={() => setDeep((value) => !value)} aria-pressed={deep} title="Модель рассуждает дольше, но точнее: для сложных вопросов и задач"><Brain size={14} /> Подумать глубже</button>
            <span className="ai-note">Enter — отправить, Shift+Enter — новая строка. Не пишите личные данные: сообщения уходят в DeepSeek, подробнее — в <Link to="/privacy#ai">политике конфиденциальности</Link>.</span>
          </div>
        </form>
      </div>
    </div>
  </section>
}
