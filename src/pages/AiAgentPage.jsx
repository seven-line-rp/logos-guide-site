import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, RotateCcw, SendHorizontal, Square, TriangleAlert } from 'lucide-react'
import { askAgent, MAX_INPUT } from '../ai-chat.js'
import { AiMessageText } from '../components/ai-message.js'

// Чат с ИИ-агентом (DeepSeek через public/api/ai-chat.php). История живёт
// только в памяти страницы: после перезагрузки начинается новый разговор,
// в localStorage ничего не пишется.

const suggestions = [
  'Где библиотека и как до неё дойти?',
  'Какие специальности есть в колледже?',
  'Как пользоваться маршрутом на сайте?',
  'Расскажи о колледже «Логос»',
]

const greeting = 'Привет! Я ИИ-агент путеводителя. Подскажу, где кабинет и как пройти, расскажу о разделах сайта и о колледже «Логос». Можно и просто поболтать.'

export default function AiAgentPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const controller = useRef(null)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    const list = listRef.current
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
  }, [messages, pending])

  const send = async (text, history = messages) => {
    const content = text.trim().slice(0, MAX_INPUT)
    if (!content || pending) return
    const next = [...history, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setPending(true)
    controller.current = new AbortController()
    try {
      const reply = await askAgent(next, { signal: controller.current.signal })
      setMessages((current) => [...current, { role: 'assistant', content: reply }])
    } catch (error) {
      if (error.name !== 'AbortError') setMessages((current) => [...current, { role: 'assistant', content: error.message, error: true }])
    } finally {
      controller.current = null
      setPending(false)
      inputRef.current?.focus()
    }
  }

  const stop = () => controller.current?.abort()
  const reset = () => { stop(); setMessages([]); setInput(''); inputRef.current?.focus() }
  // Повтор: убираем ошибку и последний вопрос, затем отправляем его заново.
  const retry = () => {
    const lastUser = messages.findLastIndex((message) => message.role === 'user')
    if (lastUser >= 0) send(messages[lastUser].content, messages.slice(0, lastUser))
  }
  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(input) }
  }

  const last = messages[messages.length - 1]
  return <section className="ai-page container">
    <header className="ai-head">
      <span className="eyebrow"><i className="eyebrow-dot" />ИИ-АГЕНТ · ТЕСТОВЫЙ РЕЖИМ</span>
      <h1>Спросите <em>путеводитель.</em></h1>
      <p>Ассистент знает план корпуса, разделы сайта и материалы с <a href="https://колледжлогос.рф" target="_blank" rel="noopener noreferrer">колледжлогос.рф</a>. Отвечает нейросеть DeepSeek — она может ошибаться, поэтому важное уточняйте в колледже.</p>
    </header>

    <div className="ai-chat">
      <div className="ai-chat-top">
        <span className="ai-chat-title"><span className="ai-avatar"><Bot size={17} /></span><span><strong>ИИ-Агент</strong><small>{pending ? 'печатает…' : 'на связи'}</small></span><span className="nav-badge">ТЕСТ</span></span>
        <button className="ai-reset" type="button" onClick={reset} disabled={!messages.length && !input} title="Начать новый разговор"><RotateCcw size={15} /><span>Новый чат</span></button>
      </div>

      <div className="ai-messages" ref={listRef} role="log" aria-live="polite" aria-label="Сообщения">
        <div className="ai-message ai-message-assistant"><span className="ai-avatar" aria-hidden="true"><Bot size={15} /></span><div className="ai-bubble"><p>{greeting}</p></div></div>
        {messages.map((message, index) => <div key={index} className={`ai-message ai-message-${message.role} ${message.error ? 'ai-message-error' : ''}`}>
          {message.role === 'assistant' && <span className="ai-avatar" aria-hidden="true">{message.error ? <TriangleAlert size={15} /> : <Bot size={15} />}</span>}
          <div className="ai-bubble"><AiMessageText text={message.content} plain={message.role === 'user'} />{message.error && index === messages.length - 1 && <button type="button" className="ai-retry" onClick={retry}>Повторить</button>}</div>
        </div>)}
        {pending && <div className="ai-message ai-message-assistant"><span className="ai-avatar" aria-hidden="true"><Bot size={15} /></span><div className="ai-bubble ai-typing" role="status" aria-label="ИИ печатает"><i /><i /><i /></div></div>}
      </div>

      {(!messages.length || last?.error) && !pending && <div className="ai-suggestions" aria-label="Примеры вопросов">{suggestions.map((text) => <button key={text} type="button" onClick={() => send(text, last?.error ? messages.slice(0, -2) : messages)}>{text}</button>)}</div>}

      <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); send(input) }}>
        <label className="visually-hidden" htmlFor="ai-input">Сообщение ИИ-агенту</label>
        <textarea id="ai-input" ref={inputRef} rows={1} value={input} maxLength={MAX_INPUT} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Спросите о кабинете, сайте или колледже…" />
        {pending
          ? <button className="ai-send" type="button" onClick={stop} aria-label="Остановить ответ" title="Остановить"><Square size={16} /></button>
          : <button className="ai-send" type="submit" disabled={!input.trim()} aria-label="Отправить" title="Отправить (Enter)"><SendHorizontal size={17} /></button>}
      </form>
      <p className="ai-note">Enter — отправить, Shift+Enter — новая строка. Не пишите личные данные: сообщения уходят в DeepSeek, подробнее — в <Link to="/privacy#ai">политике конфиденциальности</Link>.</p>
    </div>
  </section>
}
