import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellOff, BellRing, CalendarClock, CalendarCheck2, Check, Laptop, Megaphone, PartyPopper, Send, Smartphone, Sparkles, TriangleAlert, Zap } from 'lucide-react'
import { PageHeading } from '../components/Primitives.jsx'
import { useSchedule } from '../components/NextLesson.jsx'
import { rooms } from '../data.js'
import { nextLesson } from '../schedule.js'
import { PUSH_KINDS, PUSH_TOPICS, currentSubscription, pushSupport, readTopics, samplePush, sendTestPush, showLocalPush, subscribePush, syncScheduleForPush, unsubscribePush } from '../push.js'

// Тестовые push-уведомления: включить их пока можно только здесь (в меню
// страницы нет). Каждый вид можно показать сразу на устройстве или прислать
// через сервер, как придёт настоящее. Устройство — src/push.js, сервер — public/api/push.php.

const KIND_ICONS = { 'lesson-start': CalendarClock, 'lesson-end': CalendarCheck2, event: PartyPopper, update: Sparkles, news: Megaphone }

const GUIDES = {
  android: { title: 'Android', icon: Smartphone, steps: [
    'Откройте сайт в Chrome, Яндекс Браузере или Samsung Internet.',
    'Нажмите «Включить уведомления» и разрешите их во всплывающем окне.',
    'Чтобы уведомления приходили, даже когда браузер закрыт, добавьте сайт на главный экран: меню ⋮ → «Добавить на гл. экран».',
  ] },
  ios: { title: 'iPhone', icon: Smartphone, steps: [
    'Нужен iOS 16.4 или новее. Откройте сайт в Safari.',
    'Нажмите «Поделиться» → «На экран „Домой“» → «Добавить».',
    'Откройте ЛОГОС с иконки на экране «Домой» и включите уведомления на этой странице.',
    'Если уведомлений нет: Настройки → Уведомления → ЛОГОС → «Допуск уведомлений».',
  ] },
  desktop: { title: 'Компьютер', icon: Laptop, steps: [
    'Подходят Chrome, Edge, Яндекс Браузер, Firefox и Safari на macOS 13+.',
    'Нажмите «Включить уведомления» и разрешите их рядом с адресной строкой.',
    'В Windows проверьте, что уведомления браузера не выключены в «Параметры → Система → Уведомления», а в macOS — в «Системных настройках → Уведомления».',
  ] },
}

function useSubscription() {
  const [support, setSupport] = useState(() => pushSupport())
  const [subscription, setSubscription] = useState(null)
  const refresh = useCallback(async () => {
    setSupport(pushSupport())
    setSubscription(await currentSubscription().catch(() => null))
  }, [])
  useEffect(() => {
    refresh()
    // Разрешение могли поменять в настройках браузера, пока вкладка была в фоне.
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])
  return { support, subscription, refresh }
}

function NotificationPreview({ push, kind }) {
  const Icon = KIND_ICONS[kind]
  return <div className={`tn-preview tn-tone-${PUSH_KINDS[kind].tone}`} aria-hidden="true">
    <img className="tn-preview-app" src="/apple-touch-icon.png" alt="" />
    <div className="tn-preview-text">
      <span className="tn-preview-meta"><strong>ЛОГОС</strong> · сейчас</span>
      <strong className="tn-preview-title">{push.title}</strong>
      <span className="tn-preview-body">{push.body}</span>
    </div>
    <span className="tn-preview-kind"><Icon size={15} /></span>
  </div>
}

function StatusCard({ support, subscription, busy, onEnable, onDisable }) {
  const on = Boolean(subscription) && support.permission === 'granted'
  let title = 'Уведомления выключены'
  let text = 'Включите, и сайт напомнит о паре, событии или новой версии, даже когда он закрыт.'
  let tone = 'off'
  if (on) { title = 'Уведомления включены'; text = 'Это устройство подписано. Ниже можно проверить каждый вид уведомлений.'; tone = 'on' }
  else if (!support.secure) { title = 'Нужно защищённое соединение'; text = 'Уведомления работают только по https://, откройте logos-guide.ru.'; tone = 'bad' }
  else if (support.needsInstall) { title = 'Сначала добавьте сайт на экран «Домой»'; text = 'На iPhone уведомления приходят только от сайта, открытого с иконки. Как это сделать — ниже.'; tone = 'warn' }
  else if (!support.notifications) { title = 'Браузер не умеет уведомления'; text = 'Попробуйте Chrome, Edge, Firefox или Safari последней версии.'; tone = 'bad' }
  else if (support.inApp) { title = 'Откройте сайт в браузере'; text = 'Вы смотрите сайт во встроенном браузере (Telegram, ВК и т. п.), в нём разрешить уведомления нельзя. Нажмите ⋮ → «Открыть в браузере» или скопируйте ссылку в Chrome или Safari.'; tone = 'warn' }
  else if (support.permission === 'denied') { title = 'Уведомления запрещены'; text = 'Разрешите их для сайта: нажмите на значок слева от адреса (на Android: ⋮ → «Информация» → «Разрешения» → «Уведомления») и обновите страницу.'; tone = 'bad' }
  else if (!support.push) { title = 'Можно только проверить'; text = 'Здесь работают уведомления, пока сайт открыт. Фоновые приходят в собранной версии сайта.'; tone = 'warn' }
  const canEnable = support.notifications && support.permission !== 'denied' && support.secure && !support.inApp
  return <section className={`tn-status tn-status-${tone}`} aria-live="polite">
    <span className="tn-status-icon" aria-hidden="true">{on ? <BellRing size={26} /> : tone === 'bad' ? <BellOff size={26} /> : <BellRing size={26} />}</span>
    <div className="tn-status-copy">
      <span className="tn-status-badge">{on ? 'Включено' : 'Тест'}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
    <div className="tn-status-actions">
      {on
        ? <button type="button" className="tn-button" onClick={onDisable} disabled={busy}><BellOff size={16} /> Отключить</button>
        : canEnable && <button type="button" className="button button-primary tn-enable" onClick={onEnable} disabled={busy}><BellRing size={17} /> {busy ? 'Включаем…' : 'Включить уведомления'}</button>}
    </div>
  </section>
}

export default function TestNotificationsPage() {
  const { support, subscription, refresh } = useSubscription()
  const lessons = useSchedule()
  const [topics, setTopics] = useState(readTopics)
  const [busy, setBusy] = useState('')
  const [flash, setFlash] = useState({ kind: '', text: '' })
  const [guide, setGuide] = useState(support.platform)
  const subscribed = Boolean(subscription) && support.permission === 'granted'

  const lesson = useMemo(() => nextLesson(lessons)?.lesson, [lessons])
  const room = lesson && rooms.find((item) => item.id === lesson.roomId)
  const roomLabel = room ? `${room.name}${room.number ? ` №${room.number}` : ''}` : ''
  const samples = useMemo(() => Object.keys(PUSH_KINDS).map((kind) => ({ kind, push: samplePush(kind, { lesson, roomLabel }) })), [lesson, roomLabel])

  const run = async (id, action, done) => {
    setBusy(id); setFlash({ kind: '', text: '' })
    try {
      await action()
      if (done) setFlash({ kind: 'ok', text: done })
    } catch (error) {
      setFlash({ kind: 'bad', text: error.message || 'Не получилось. Попробуйте ещё раз.' })
    } finally {
      setBusy('')
      refresh()
    }
  }

  const enable = () => run('enable', async () => {
    await subscribePush(topics)
    await syncScheduleForPush(lessons)
  }, 'Готово! Теперь проверьте уведомления ниже.')
  const disable = () => run('enable', unsubscribePush, 'Уведомления отключены. Это устройство больше ничего не получит.')
  const toggleTopic = (id) => {
    const next = topics.includes(id) ? topics.filter((topic) => topic !== id) : [...topics, id]
    setTopics(next)
    if (subscribed) run('topics', () => subscribePush(next), 'Темы сохранены.')
  }
  const showAll = () => run('all', async () => {
    for (const [index, sample] of samples.entries()) {
      if (index) await new Promise((resolve) => setTimeout(resolve, 1400))
      await showLocalPush({ ...sample.push, tag: `test-${sample.kind}` })
    }
  }, 'Показали все пять. Если их не видно, проверьте режим «Не беспокоить».')

  const Guide = GUIDES[guide]
  return <>
    <PageHeading eyebrow="Тестовый режим" title="Уведомления" description="Напоминания о парах, события в колледже и новые версии сайта. Работают на Android, iPhone и компьютере. Пока их можно включить только на этой странице." />
    <div className="container tn">
      <StatusCard support={support} subscription={subscription} busy={busy === 'enable'} onEnable={enable} onDisable={disable} />
      {flash.text && <p className={`tn-flash tn-flash-${flash.kind}`} role="status">{flash.kind === 'ok' ? <Check size={16} /> : <TriangleAlert size={16} />} {flash.text}</p>}

      <section className="tn-section">
        <div className="tn-section-head">
          <div><h2>Проверить каждое</h2><p>«Показать» — уведомление появится сразу. «С сервера» — придёт тем же путём, что и настоящее: можно закрыть сайт и подождать.</p></div>
          <button type="button" className="tn-button tn-button-accent" onClick={showAll} disabled={Boolean(busy) || !support.notifications || support.permission === 'denied'}><Zap size={16} /> {busy === 'all' ? 'Показываем…' : 'Показать все'}</button>
        </div>
        <ul className="tn-grid">
          {samples.map(({ kind, push }) => <li key={kind} className="tn-card">
            <span className={`tn-card-label tn-tone-${PUSH_KINDS[kind].tone}`}>{PUSH_KINDS[kind].label}</span>
            <NotificationPreview push={push} kind={kind} />
            <div className="tn-card-actions">
              <button type="button" className="tn-button" onClick={() => run(`local-${kind}`, () => showLocalPush({ ...push, tag: `test-${kind}` }))} disabled={Boolean(busy) || !support.notifications || support.permission === 'denied'}><BellRing size={15} /> Показать</button>
              <button type="button" className="tn-button" onClick={() => run(`server-${kind}`, () => sendTestPush(kind), 'Отправили. Уведомление придёт через пару секунд.')} disabled={Boolean(busy) || !subscribed} title={subscribed ? '' : 'Сначала включите уведомления'}><Send size={15} /> {busy === `server-${kind}` ? 'Отправляем…' : 'С сервера'}</button>
            </div>
          </li>)}
        </ul>
        {!lesson && <p className="tn-note">Добавьте пары в «Моё расписание», и в уведомлении о паре появятся предмет, кабинет и кнопка маршрута.</p>}
      </section>

      <div className="tn-columns">
        <section className="tn-section tn-panel">
          <h2>Что присылать</h2>
          <p className="tn-muted">{subscribed ? 'Изменения сохраняются сразу.' : 'Выберите до включения или поменяйте потом.'}</p>
          <ul className="tn-topics">
            {PUSH_TOPICS.map((topic) => <li key={topic.id}>
              <label className="tn-topic">
                <span><strong>{topic.title}</strong><small>{topic.hint}</small></span>
                <input type="checkbox" role="switch" checked={topics.includes(topic.id)} onChange={() => toggleTopic(topic.id)} disabled={busy === 'topics'} />
                <i aria-hidden="true" />
              </label>
            </li>)}
          </ul>
        </section>

        <section className="tn-section tn-panel">
          <h2>Как включить</h2>
          <div className="tn-tabs" role="tablist" aria-label="Устройство">
            {Object.entries(GUIDES).map(([id, item]) => <button key={id} type="button" role="tab" aria-selected={guide === id} className={guide === id ? 'tn-tab-active' : ''} onClick={() => setGuide(id)}>{item.title}{id === support.platform && <small>у вас</small>}</button>)}
          </div>
          <ol className="tn-steps" role="tabpanel" aria-label={Guide.title}>{Guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        </section>
      </div>

      <p className="tn-note">Сайт хранит на сервере только адрес подписки браузера и выбранные темы. Расписание остаётся на устройстве: предмет и кабинет подставляются в уведомление уже на нём. Подробнее в политике конфиденциальности.</p>
    </div>
  </>
}
