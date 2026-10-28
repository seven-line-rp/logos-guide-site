import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Bug, Check, Lightbulb, MessageCircleQuestion, Send } from 'lucide-react'
import { PageHeading } from '../components/Primitives.jsx'

// «Сообщить о проблеме»: общая форма сайта. Сообщение уходит на /api/report.php
// (файл logos-reports/reports.jsonl на хостинге, см. deploy/reports.md) вместе с
// адресом страницы, с которой человек пришёл, и названием браузера. Контакт
// необязателен: нужен, только если хочется получить ответ. С контактом нужна
// отметка о согласии на обработку персональных данных (страница /consent).

export const FEEDBACK_KINDS = [
  { id: 'bug', icon: Bug, title: 'Что-то сломалось', hint: 'Не открывается, зависает, текст налезает' },
  { id: 'ai', icon: Bot, title: 'Ошибка ИИ', hint: 'Неверный ответ, иероглифы, странности' },
  { id: 'idea', icon: Lightbulb, title: 'Идея', hint: 'Чего не хватает на сайте' },
  { id: 'question', icon: MessageCircleQuestion, title: 'Вопрос', hint: 'Не нашли, как что-то сделать' },
]

const MAX_TEXT = 1200

export default function FeedbackPage() {
  const from = typeof document !== 'undefined' && document.referrer && new URL(document.referrer, location.href).origin === location.origin ? new URL(document.referrer).pathname : ''
  const [kind, setKind] = useState('bug')
  const [text, setText] = useState('')
  const [contact, setContact] = useState('')
  const [agreed, setAgreed] = useState(false)
  const hasContact = contact.trim() !== ''
  const [state, setState] = useState({ status: 'idle', error: '' })

  const send = async (event) => {
    event.preventDefault()
    if (text.trim().length < 5) { setState({ status: 'idle', error: 'Опишите проблему хотя бы парой слов.' }); return }
    if (hasContact && !agreed) { setState({ status: 'idle', error: 'Чтобы оставить контакт, отметьте согласие на обработку персональных данных или сотрите контакт.' }); return }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setState({ status: 'idle', error: 'Нет интернета. Попробуйте, когда появится сеть.' }); return }
    setState({ status: 'sending', error: '' })
    try {
      const response = await fetch('/api/report.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, text, contact: hasContact && agreed ? contact.trim() : '', consent: hasContact && agreed, page: from, agent: navigator.userAgent.slice(0, 160), website: event.currentTarget.website?.value || '' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Не получилось отправить. Попробуйте позже.')
      setState({ status: 'sent', error: '' })
    } catch (error) {
      setState({ status: 'idle', error: error.message || 'Не получилось отправить. Попробуйте позже.' })
    }
  }

  return <>
    <PageHeading title="Сообщить о проблеме" description="Нашли баг, ошибку ИИ или хотите что-то предложить? Напишите: сообщение попадёт к команде сайта." />
    <section className="container feedback">
      {state.status === 'sent'
        ? <div className="feedback-done" role="status"><Check size={22} /><div><strong>Спасибо, сообщение отправлено.</strong><p>Команда прочитает его и поправит сайт. Если оставили контакт, мы можем написать в ответ.</p><Link className="button button-primary" to="/">На главную</Link></div></div>
        : <form className="feedback-form" onSubmit={send}>
          <div className="feedback-kinds" role="radiogroup" aria-label="Тип обращения">
            {FEEDBACK_KINDS.map(({ id, icon: Icon, title, hint }) => <label key={id} className={kind === id ? 'feedback-kind is-active' : 'feedback-kind'}>
              <input type="radio" name="kind" value={id} checked={kind === id} onChange={() => setKind(id)} />
              <Icon size={18} /><span><strong>{title}</strong><small>{hint}</small></span>
            </label>)}
          </div>
          <label className="feedback-field"><span>Что случилось</span>
            <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={MAX_TEXT} rows={6} placeholder={kind === 'bug' ? 'На какой странице, что нажали, что увидели. Какое устройство: телефон, доска, компьютер.' : kind === 'ai' ? 'Что спросили и что ответил ИИ.' : 'Опишите своими словами'} />
            <small>{text.length} / {MAX_TEXT}</small>
          </label>
          <label className="feedback-field"><span>Как с вами связаться <em>(необязательно)</em></span>
            <input type="text" value={contact} onChange={(event) => setContact(event.target.value)} maxLength={80} autoComplete="off" placeholder="Почта или @ник в Telegram" />
          </label>
          {hasContact && <label className="feedback-consent">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>Согласен(на) на <Link to="/consent" target="_blank">обработку персональных данных</Link>: контакт нужен только для ответа на это обращение.</span>
          </label>}
          <input className="report-trap" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
          {state.error && <p className="report-error" role="alert">{state.error}</p>}
          <button className="button button-primary" type="submit" disabled={state.status === 'sending'}><Send size={15} /> {state.status === 'sending' ? 'Отправляем…' : 'Отправить'}</button>
          <p className="feedback-note">Вместе с текстом отправятся адрес страницы, с которой вы пришли, и название браузера. Подробнее — в <Link to="/privacy#feedback">политике конфиденциальности</Link>.</p>
        </form>}
    </section>
  </>
}
