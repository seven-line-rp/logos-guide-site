import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Accessibility, AlarmClock, ArrowLeft, ArrowRight, ArrowUpDown, ArrowUpRight, Check, ChevronDown, Flag, Footprints, Handshake, Info, Map as MapIcon, MapPin, MessageCircle, MoveDown, MoveUp, Navigation, Pause, Play, Plus, RotateCcw, Share2, Star, TriangleAlert, Users, Volume2, VolumeX, X } from 'lucide-react'
import { rooms } from '../data.js'
import RouteScene from '../components/RouteScene.jsx'
import RoomSearchSelect from '../components/RoomSearchSelect.jsx'
import { buildRouteOptions, pickRoute } from '../map-routing.js'
import { buildTripSteps } from '../route-steps.js'
import { readManualLocation } from '../map-location.js'
import { VOICE_PRESETS, getStoredPreset, setVoicePreset, speakText, stopSpeech } from '../speech.js'
import { VOICE_PACK_MALE_ID, playVoicePack, stopVoicePack, voicePackForPreset } from '../voice-pack.js'
import { storageGet, storageSet } from '../storage.js'
import { NOTICE_TYPES, avoidClosed, closedRoomIds, useNotices } from '../notices.js'
import { findNearest, nearbyKinds, rememberRoute } from '../places.js'
import { arrivalStatus, formatCountdown, nextLesson, readSchedule } from '../schedule.js'
import { useFavorite } from '../components/FavoriteButton.jsx'
import ShareRoute from '../components/ShareRoute.jsx'
import WalkMode from '../components/WalkMode.jsx'
import { crowdMoment, readHere, readNeedLift, setHere, setNeedLift, useHere, useNeedLift, withCrowd } from '../route-prefs.js'

// Страница маршрута устроена как навигатор: слева панель (откуда/куда,
// сводка, варианты, шаги, озвучка), справа большая карта с текущей
// подсказкой и пультом «Назад / Повторить / Дальше». Маршрут пересчитывается
// сразу при выборе точек; кнопка «Начать» лишь запускает ведение с первого шага.

function roomName(room) { return `${room.name}${room.number ? ` №${room.number}` : ''}` }
function plural(count, one, few, many) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few
  return many
}
function stepLabel(count) { return `${count} ${plural(count, 'шаг', 'шага', 'шагов')}` }
function minutes(seconds) { return Math.max(1, Math.round(seconds / 60)) }
const prefersFlatMap = () => window.matchMedia('(max-width: 680px), (max-height: 500px) and (pointer: coarse)').matches

const stepIcon = (step) => step.kind === 'start' ? MapPin : step.kind === 'arrive' ? Check : step.kind === 'stop' ? Pause : step.kind === 'transfer' ? (step.title.startsWith('Поднимитесь') ? MoveUp : MoveDown) : Footprints

function useCrowdMoment() {
  const [moment, setMoment] = useState(() => crowdMoment())
  useEffect(() => {
    const timer = window.setInterval(() => setMoment(crowdMoment()), 30000)
    return () => window.clearInterval(timer)
  }, [])
  return moment
}

export default function RoutePage() {
  const [params] = useSearchParams()
  const manualPoint = readManualLocation(storageGet('map-manual-point'))
  const known = (id) => rooms.some((room) => room.id === id)
  // Старт по умолчанию: из ссылки, иначе там, где закончился прошлый маршрут
  // («я здесь», src/route-prefs.js), иначе главный вход.
  const [startId, setStartId] = useState(() => params.get('from') === 'manual' && manualPoint ? 'manual' : known(params.get('from')) ? params.get('from') : readHere()?.roomId || 'entrance-1')
  // ?nearest=toilet — цель выбирается сама: ближайшее место нужного вида.
  const [targetId, setTargetId] = useState(() => {
    if (known(params.get('to'))) return params.get('to')
    const from = params.get('from') === 'manual' && manualPoint ? manualPoint : known(params.get('from')) ? params.get('from') : readHere()?.roomId || 'entrance-1'
    return findNearest(from, params.get('nearest'), typeof from === 'string' ? from : '')?.room.id || 'auditorium-104'
  })
  // Остановка по пути (?via=changing-room): маршрут из двух частей.
  const [viaId, setViaId] = useState(() => known(params.get('via')) ? params.get('via') : '')
  const [viaOpen, setViaOpen] = useState(() => known(params.get('via')))
  const needLift = useNeedLift()
  const here = useHere()
  // Вариант маршрута: 'auto' — самый быстрый, 'stairs' — ближайшая лестница,
  // либо точный вид ('lift', 'stairs-west', 'stairs-middle', 'stairs-north').
  // С профилем «Мне нужен лифт» по умолчанию всегда лифт.
  const [routePreference, setRoutePreference] = useState(() => {
    const mode = params.get('mode')
    return mode && ['lift', 'stairs', 'stairs-west', 'stairs-middle', 'stairs-north'].includes(mode) ? mode : readNeedLift() ? 'lift' : 'auto'
  })
  const toggleNeedLift = () => { setNeedLift(!needLift); setRoutePreference(needLift ? 'auto' : 'lift') }
  const meet = params.get('meet') === '1' ? { at: /^([01]\d|2[0-3]):[0-5]\d$/.test(params.get('at') || '') ? params.get('at') : '' } : null
  const start = startId === 'manual' && manualPoint ? manualPoint : rooms.find((room) => room.id === startId) || rooms.find((room) => room.id === 'entrance-1')
  const target = rooms.find((room) => room.id === targetId) || rooms[0]
  const via = viaId && viaId !== targetId && viaId !== startId ? rooms.find((room) => room.id === viaId) : null
  const startLabel = startId === 'manual' ? 'Ваша отметка' : roomName(start)
  const crossFloor = start.floor !== target.floor
  // Закрытые по объявлениям лестницы и лифт маршрут обходит (public/notices.json).
  const notices = useNotices()
  const closed = useMemo(() => closedRoomIds(notices), [notices])
  // На перемене и в обед переход между этажами считаем с запасом (оценка).
  const crowd = useCrowdMoment()
  const startPoint = startId === 'manual' && manualPoint ? manualPoint : start.id
  const optionsFor = (from, toId) => withCrowd(avoidClosed(buildRouteOptions(from, toId), closed), crowd)
  const legPlan = useMemo(() => {
    const parts = via ? [[startPoint, start, via], [via.id, via, target]] : [[startPoint, start, target]]
    return parts.map(([from, fromRoom, toRoom]) => ({ from, fromRoom, toRoom, options: optionsFor(from, toRoom.id) }))
    // optionsFor зависит только от перечисленного ниже
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startPoint, start, via, target, closed, crowd])
  const routeOptions = via ? [] : legPlan[0].options
  const legs = useMemo(() => legPlan.map((plan) => ({ ...plan, route: pickRoute(plan.options, routePreference) })), [legPlan, routePreference])
  // Сводка по всему пути: у маршрута с остановкой — сумма частей.
  const route = via ? {
    kind: legs.map((leg) => leg.route.kind || 'same').join('+'),
    meters: legs.reduce((sum, leg) => sum + (leg.route.meters || 0), 0),
    seconds: legs.reduce((sum, leg) => sum + (leg.route.seconds || 0), 0),
    footsteps: legs.reduce((sum, leg) => sum + (leg.route.footsteps || 0), 0),
    length: legs.reduce((sum, leg) => sum + (leg.route.length || 0), 0),
    transfer: legs.find((leg) => leg.route.transfer)?.route.transfer || null,
    crowdSeconds: legs.reduce((sum, leg) => sum + (leg.route.crowdSeconds || 0), 0),
    byFloor: {},
  } : legs[0].route
  const transition = route.transfer?.kind === 'lift' || !route.transfer ? 'lift' : route.transfer.kind
  const sameRoom = !via && !crossFloor && route.length === 0
  // Каждый шаг знает свой этаж, часть пути (leg) и вершину маршрута: по ним
  // на плане двигается точка, а пройденная часть линии остаётся бледной.
  const steps = buildTripSteps(legs.map((leg, index) => ({
    startLabel: index === 0 ? startLabel : roomName(leg.fromRoom),
    startFloor: leg.fromRoom.floor,
    targetFloor: leg.toRoom.floor,
    targetName: roomName(leg.toRoom),
    route: leg.route,
    sameRoom: index === 0 && sameRoom,
  })))

  const routeKey = [startId, via?.id || '', target.id, route.kind || 'same'].join('|')
  const [nav, setNav] = useState({ key: routeKey, index: 0 })
  const stepIndex = nav.key === routeKey ? Math.min(nav.index, steps.length - 1) : 0
  const current = steps[stepIndex]
  const CurrentIcon = stepIcon(current)
  // Этаж на карте: по умолчанию — этаж текущего шага; кнопками этажей можно
  // заглянуть на другой, пока не сменится шаг.
  const [peek, setPeek] = useState({ key: '', floor: null })
  const peekKey = `${routeKey}|${stepIndex}`
  const shownFloor = peek.key === peekKey && peek.floor ? peek.floor : current.floor
  // Часть пути текущего шага: её линию и её цель показывает план.
  const shownLeg = legs[current.leg || 0]
  const legCross = shownLeg.fromRoom.floor !== shownLeg.toRoom.floor

  // Голос включён по умолчанию: первую фразу всё равно слышно только после
  // нажатия кнопки, поэтому браузер автозапуск не блокирует.
  const [voiceOn, setVoiceOn] = useState(() => storageGet('route-voice') === 'on' || storageGet('route-voice') === null)
  const [voiceNotice, setVoiceNotice] = useState('')
  const [voicePreset, setVoicePresetState] = useState(getStoredPreset)
  const voiceRequest = useRef(0)
  const [mode3d, setMode3d] = useState(true)
  // Камера летит за шагом, когда человек начал маршрут или листает шаги;
  // до этого и после ручного управления картой показан весь путь.
  const [follow, setFollow] = useState({ key: '', on: false })
  const following = follow.key === routeKey && follow.on
  const setFollowing = (on) => setFollow({ key: routeKey, on })
  const [picked, setPicked] = useState(null)
  const stageRef = useRef(null)

  // Любое новое действие отменяет и воспроизведение, и отложенный запасной синтез.
  const cancelVoice = () => {
    voiceRequest.current += 1
    stopSpeech()
    stopVoicePack()
    return voiceRequest.current
  }
  useEffect(() => () => {
    voiceRequest.current += 1
    stopSpeech()
    stopVoicePack()
  }, [routeKey])

  const playPrompt = async (keys, text, preset = voicePreset) => {
    const request = cancelVoice()
    setVoiceNotice('')
    // playVoicePack разблокирует звук прямо в обработчике нажатия, до загрузки
    // mp3: после await Safari уже теряет пользовательский жест.
    const result = keys.length ? await playVoicePack(keys, { voice: preset === VOICE_PACK_MALE_ID ? 'male' : 'female' }) : 'empty'
    if (request !== voiceRequest.current || result === 'stopped' || result === 'played') return
    if (result === 'blocked') {
      setVoiceNotice('Звук не разблокировался. Нажмите «Прослушать» ещё раз и проверьте громкость и беззвучный режим iPhone.')
      return
    }
    const fallback = await speakText(text, { preset: preset === VOICE_PACK_MALE_ID ? 'male' : 'female' })
    if (request !== voiceRequest.current || fallback === 'stopped') return
    if (fallback === 'unsupported') setVoiceNotice('Запись не воспроизвелась, а синтез речи недоступен. Проверьте подключение и нажмите «Прослушать» ещё раз.')
    else if (fallback === 'foreign-voice' || fallback === 'no-voice') setVoiceNotice('Запись не воспроизвелась. Для запасной озвучки нужен русский системный голос; повторите попытку или проверьте подключение.')
  }
  const goToStep = (index, withVoice = true) => {
    const next = Math.max(0, Math.min(steps.length - 1, index))
    setNav({ key: routeKey, index: next })
    setFollowing(true)
    if (withVoice && voiceOn) void playPrompt(steps[next].voiceCue || [], steps[next].say)
  }
  const enableVoice = () => { setVoiceOn(true); storageSet('route-voice', 'on') }
  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    storageSet('route-voice', next ? 'on' : 'off')
    cancelVoice()
    setVoiceNotice('')
    if (next) void playPrompt(['route-built'], current.say)
  }
  const changePreset = (presetId) => {
    if (!voicePackForPreset(presetId)) return
    cancelVoice()
    setVoicePresetState(presetId)
    setVoicePreset(presetId)
    if (voiceOn) void playPrompt(['route-built'], 'Голос изменён.', presetId)
  }
  const testVoice = () => { enableVoice(); void playPrompt(['route-built', 'corridor-1-east'], 'Маршрут построен. Следуйте прямо по коридору.') }
  const repeatStep = () => { enableVoice(); void playPrompt(current.voiceCue || [], current.say) }
  const startNavigation = () => {
    cancelVoice()
    setNav({ key: routeKey, index: 0 })
    setFollowing(true)
    setPeek({ key: '', floor: null })
    if (prefersFlatMap()) stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (voiceOn) void playPrompt([...new Set(['route-built', ...(steps[0].voiceCue || [])])], `Маршрут построен. ${steps[0].say}`)
  }
  // Недавние маршруты: запоминаем, если человек задержался на маршруте.
  useEffect(() => {
    const timer = window.setTimeout(() => rememberRoute(startId, target.id), 2500)
    return () => window.clearTimeout(timer)
  }, [startId, target.id])
  const [walking, setWalking] = useState(false)
  const arrive = () => {
    setHere(target.id)
    setWalking(false)
    if (startId !== target.id) setStartId(target.id)
  }
  const [favorite, toggleFavorite] = useFavorite(target.id)
  const [sharing, setSharing] = useState(false)
  // «Успеть на пару»: время до начала берём из своего расписания, если
  // следующая пара — в этом кабинете, иначе человек выбирает его сам.
  const lessonAhead = useMemo(() => { const next = nextLesson(readSchedule()); return next && next.lesson.roomId === target.id && next.minutes < 180 ? next : null }, [target.id])
  const meetMinutes = useMemo(() => {
    if (!meet?.at) return null
    const now = new Date()
    const [h, m] = meet.at.split(':').map(Number)
    const left = h * 60 + m - (now.getHours() * 60 + now.getMinutes())
    return left > 0 && left < 180 ? left : null
  }, [meet?.at])
  const [deadline, setDeadline] = useState(null)
  const minutesLeft = deadline ?? (lessonAhead ? lessonAhead.minutes : meetMinutes)
  const arrival = minutesLeft === null || sameRoom ? null : arrivalStatus(route.seconds, minutesLeft)
  const fastest = via ? null : routeOptions[0]
  const nearestFrom = startId === 'manual' && manualPoint ? manualPoint : start.id
  const goNearest = (kind) => {
    const found = findNearest(nearestFrom, kind, startId)
    if (found) { setTargetId(found.room.id); setPicked(null) }
  }
  const targetNotices = notices.filter((notice) => notice.roomId === target.id || (route.transfer && (notice.roomId === route.transfer.startId || notice.roomId === route.transfer.endId)))
  const canSwap = startId !== 'manual'
  const swapPoints = () => {
    if (!canSwap) return
    setStartId(targetId)
    setTargetId(startId)
  }
  const resetRoute = () => { setStartId('entrance-1'); setTargetId('auditorium-104'); setViaId(''); setViaOpen(false); setRoutePreference(needLift ? 'lift' : 'auto') }
  const mapUrl = `/map?floor=${target.floor}&from=${encodeURIComponent(startId)}&to=${encodeURIComponent(target.id)}${crossFloor ? `&mode=${transition}` : ''}`

  // Стрелки на клавиатуре листают шаги, пока фокус не в поле ввода.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      if (event.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (event.key === 'ArrowRight') { event.preventDefault(); setFollow({ key: routeKey, on: true }); setNav((value) => ({ key: routeKey, index: Math.min(steps.length - 1, (value.key === routeKey ? value.index : 0) + 1) })) }
      if (event.key === 'ArrowLeft') { event.preventDefault(); setFollow({ key: routeKey, on: true }); setNav((value) => ({ key: routeKey, index: Math.max(0, (value.key === routeKey ? value.index : 0) - 1) })) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [routeKey, steps.length])

  const followsStep = shownFloor === current.floor
  const leg = shownLeg.route.byFloor[shownFloor]
  const legTransfer = shownLeg.route.transfer
  const transferMarks = legCross && legTransfer ? {
    floor: shownLeg.fromRoom.floor,
    label: `${legTransfer.kind === 'lift' ? 'Лифт' : 'Лестница'} ${shownLeg.toRoom.floor > shownLeg.fromRoom.floor ? '↑' : '↓'} ${shownLeg.toRoom.floor} этаж`,
    arrival: shownLeg.toRoom.floor,
    arrivalLabel: `${shownLeg.fromRoom.floor > shownLeg.toRoom.floor ? '↓' : '↑'} с ${shownLeg.fromRoom.floor} этажа`,
  } : null
  const pickRoom = (room) => setPicked(room)
  const pickAs = (kind) => {
    if (!picked) return
    if (kind === 'to') setTargetId(picked.id)
    else setStartId(picked.id)
    setPicked(null)
  }
  const progress = steps.length > 1 ? stepIndex / (steps.length - 1) : 1
  const viaLabel = via ? `через: ${via.name.toLowerCase()}` : crossFloor ? route.transfer?.method || route.transfer?.label : 'по одному этажу'

  return <div className="nv">
    <header className="nv-head container">
      <div>
        <span className="eyebrow">Маршрут</span>
        <h1>Куда идём?</h1>
        <p>Выберите, откуда и куда. Путь построится по коридорам, с лестницами и лифтом, и его можно пройти по шагам с голосом.</p>
      </div>
      <Link className="nv-head-link" to="/map"><MapIcon size={16} /> Карта этажей</Link>
    </header>

    <div className="nv-layout container">
      <aside className="nv-panel" aria-label="Параметры маршрута">
        <section className="nv-card nv-places">
          <div className="nv-place-rail" aria-hidden="true"><i className="nv-dot-start" /><span /><i className="nv-dot-end" /></div>
          <div className="nv-place-fields">
            <RoomSearchSelect label="Откуда" value={startId} onChange={setStartId} manualOption={manualPoint ? { value: 'manual', label: `Ваша отметка, ${manualPoint.floor} этаж` } : null} />
            {viaOpen && <div className="nv-via"><RoomSearchSelect label="Через" value={viaId} onChange={setViaId} /><button type="button" className="nv-via-remove" onClick={() => { setViaId(''); setViaOpen(false) }} aria-label="Убрать остановку"><X size={15} /></button></div>}
            <RoomSearchSelect label="Куда" value={targetId} onChange={setTargetId} />
          </div>
          <button type="button" className="nv-swap" onClick={swapPoints} disabled={!canSwap} aria-label="Поменять старт и цель местами" title="Поменять местами"><ArrowUpDown size={16} /></button>
          {here && startId === here.roomId && !params.get('from') && <p className="nv-here"><MapPin size={14} /> Старт — там, где закончился прошлый маршрут. <button type="button" onClick={() => { setHere(null); setStartId('entrance-1') }}>От входа</button></p>}
          <div className="nv-place-tools">
            {!viaOpen && <button type="button" className="nv-add-via" onClick={() => setViaOpen(true)}><Plus size={14} /> Остановка по пути</button>}
            <Link className="nv-manual" to={`/map?floor=${start.floor}&manual=1`}><MapPin size={14} /> {manualPoint ? 'Изменить свою отметку на плане' : 'Начать от своей точки на плане'}</Link>
          </div>
          <div className="nv-nearby" role="group" aria-label="Ближайшее место">
            <span>Ближайший:</span>
            {nearbyKinds.map((kind) => <button type="button" key={kind.id} onClick={() => goNearest(kind.id)}>{kind.label}</button>)}
          </div>
          <button type="button" className={`nv-switch nv-lift-switch ${needLift ? 'nv-switch-on' : ''}`} onClick={toggleNeedLift} aria-pressed={needLift}><i aria-hidden="true"><b /></i> <Accessibility size={15} aria-hidden="true" /> Мне нужен лифт <small>запомнить для всех маршрутов</small></button>
        </section>

        {meet && <section className="nv-card nv-meet" role="status"><Handshake size={18} aria-hidden="true" /><span><strong>Вас ждут: {roomName(target)}</strong>{meet.at && <em>Встреча в {meet.at}</em>}<small>Путь построен от: {startLabel}. Если вы в другом месте, поменяйте «Откуда».</small></span></section>}

        {targetNotices.length > 0 && <section className="nv-card nv-notices" aria-live="polite">
          {targetNotices.map((notice, index) => <div key={index} className={`nv-notice-item nv-notice-${NOTICE_TYPES[notice.type].tone}`}>
            <TriangleAlert size={16} aria-hidden="true" />
            <span><strong>{notice.title}</strong>{notice.text && <small>{notice.text}</small>}</span>
          </div>)}
        </section>}

        <section className="nv-card nv-summary" aria-live="polite">
          {sameRoom ? <div className="nv-same"><Check size={20} /> Вы уже на месте</div> : <>
            <div className="nv-eta">
              <strong>{route.seconds < 60 ? '<1' : minutes(route.seconds)}</strong>
              <span>{plural(minutes(route.seconds), 'минута', 'минуты', 'минут')}<small>пешком</small></span>
            </div>
            <dl className="nv-facts">
              <div><dt>Расстояние</dt><dd>≈ {Math.round(route.meters)} м</dd></div>
              <div><dt>Шагов пешком</dt><dd>~{route.footsteps}</dd></div>
              <div><dt>Путь</dt><dd>{viaLabel}</dd></div>
            </dl>
            {route.crowdSeconds > 0 && <p className="nv-crowd"><Users size={14} aria-hidden="true" /> {crowd?.kind === 'lunch' ? 'Сейчас обед' : crowd?.kind === 'before' ? 'Скоро первая пара' : 'Сейчас перемена'}: у лестниц и лифта людно, время посчитано с запасом.</p>}
          </>}
          {!sameRoom && <div className="nv-arrive">
            <span className="nv-arrive-label"><AlarmClock size={15} /> {lessonAhead && deadline === null ? `${lessonAhead.lesson.subject} ${formatCountdown(lessonAhead.minutes)}` : 'Пара через'}</span>
            <div className="nv-arrive-chips" role="group" aria-label="Сколько минут до пары">
              {[5, 10, 15, 20].map((value) => <button type="button" key={value} aria-pressed={deadline === value} onClick={() => setDeadline(deadline === value ? null : value)}>{value} мин</button>)}
            </div>
            {arrival && <div className={`nv-arrive-status nv-arrive-${arrival.kind}`} role="status">
              <strong>{arrival.text}</strong>
              <small>Путь ≈ {arrival.walk} мин{arrival.kind === 'late' && fastest && fastest !== route ? `, быстрее: ${fastest.label.toLowerCase()}` : ''}</small>
              {arrival.kind === 'late' && fastest && fastest !== route && <button type="button" onClick={() => setRoutePreference(fastest.kind)}>Выбрать</button>}
            </div>}
          </div>}
          <div className="nv-actions">
            <button type="button" className="nv-go" onClick={() => { startNavigation(); setWalking(true) }}><Navigation size={16} /> Идти</button>
            <button type="button" className={`nv-ghost nv-icon-btn ${favorite ? 'is-on' : ''}`} onClick={toggleFavorite} aria-pressed={favorite} title={favorite ? 'Убрать из избранного' : 'В избранное'} aria-label={favorite ? 'Убрать из избранного' : 'Добавить в избранное'}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button>
            <button type="button" className="nv-ghost nv-icon-btn" onClick={() => setSharing(true)} title="Поделиться маршрутом" aria-label="Поделиться маршрутом"><Share2 size={16} /></button>
            <button type="button" className="nv-ghost nv-icon-btn" onClick={resetRoute} title="Вернуть маршрут по умолчанию" aria-label="Сбросить маршрут"><RotateCcw size={15} /></button>
          </div>
        </section>

        {routeOptions.length > 1 && <section className="nv-card" aria-labelledby="nv-options-title">
          <h2 className="nv-title" id="nv-options-title">Как подняться{target.floor < start.floor ? ' и спуститься' : ''}</h2>
          <div className="nv-options" role="radiogroup" aria-label="Варианты маршрута">
            {routeOptions.map((option, index) => <button type="button" role="radio" key={option.kind} aria-checked={route === option} className={`nv-option ${route === option ? 'nv-option-on' : ''}`} onClick={() => setRoutePreference(option.kind)}>
              <span className="nv-option-icon" aria-hidden="true">{option.kind === 'lift' ? <MoveUp size={15} /> : <ArrowUpDown size={15} />}</span>
              <span className="nv-option-body"><strong>{option.label}</strong><span>≈ {Math.round(option.meters)} м, {option.seconds < 60 ? 'меньше минуты' : `${minutes(option.seconds)} мин`}</span></span>
              {index === 0 && <em>Быстрее</em>}
              {option.crowdSeconds > 0 && <small className="nv-option-crowd">+{option.crowdSeconds} с на перемене</small>}
            </button>)}
          </div>
        </section>}

        <section className="nv-card" aria-labelledby="nv-timeline-title">
          <h2 className="nv-title" id="nv-timeline-title">По шагам <span>{stepLabel(steps.length)}</span></h2>
          <ol className="nv-timeline">
            {steps.map((step, index) => {
              const Icon = stepIcon(step)
              const state = index < stepIndex ? 'nv-done' : index === stepIndex ? 'nv-now' : ''
              return <li key={`${step.title}-${index}`} className={state}>
                <button type="button" onClick={() => goToStep(index)} aria-current={index === stepIndex ? 'step' : undefined}>
                  <span className="nv-pin" aria-hidden="true">{index < stepIndex ? <Check size={13} /> : <Icon size={13} />}</span>
                  <span className="nv-item-text"><strong>{step.title}</strong><span>{step.detail}</span></span>
                </button>
              </li>
            })}
          </ol>
        </section>

        <details className="nv-card nv-sound">
          <summary>
            <span className="nv-sound-icon" aria-hidden="true">{voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />}</span>
            <span className="nv-sound-text"><strong>Озвучка</strong><span>{voiceOn ? VOICE_PRESETS.find((preset) => preset.id === voicePreset)?.label : 'выключена'}</span></span>
            <ChevronDown className="nv-chevron" size={16} aria-hidden="true" />
          </summary>
          <div className="nv-sound-body">
            <button type="button" className={`nv-switch ${voiceOn ? 'nv-switch-on' : ''}`} onClick={toggleVoice} aria-pressed={voiceOn}><i aria-hidden="true"><b /></i> Подсказки голосом</button>
            <div className="nv-voices" role="radiogroup" aria-label="Голос озвучки">
              {VOICE_PRESETS.map((preset) => <button type="button" role="radio" key={preset.id} aria-checked={voicePreset === preset.id} className={voicePreset === preset.id ? 'nv-voice-on' : ''} onClick={() => changePreset(preset.id)}>{preset.label}</button>)}
            </div>
            <button type="button" className="nv-ghost" onClick={testVoice}><Play size={13} fill="currentColor" /> Прослушать</button>
            <p>На iPhone сначала нажмите «Прослушать»: так браузер разрешит звук. Если тихо, проверьте громкость и беззвучный режим.</p>
          </div>
        </details>
        {voiceNotice && <p className="nv-notice" role="status"><Info size={14} /> {voiceNotice}</p>}
      </aside>

      <section className="nv-stage" ref={stageRef} aria-label="Карта маршрута">
        <div className="nv-now-card" aria-live="polite">
          <span className="nv-now-icon" aria-hidden="true"><CurrentIcon size={22} /></span>
          <div className="nv-now-text">
            <span>{`Шаг ${stepIndex + 1} из ${steps.length}`}, {`${current.floor} этаж`}</span>
            <strong>{current.title}</strong>
            <em>{current.detail}</em>
          </div>
        </div>

        <div className="nv-map">
          <RouteScene
            floor={shownFloor}
            points={leg?.points || []}
            progress={followsStep ? current.progress : null}
            following={following && followsStep}
            mode={mode3d ? '3d' : 'top'}
            selectedId={picked?.floor === shownFloor ? picked.id : ''}
            targetId={shownLeg.toRoom.id}
            transfer={transferMarks}
            onRoomClick={pickRoom}
            onFollowChange={setFollowing}
            notices={notices}
          />
          {picked && <div className="nv-pick" role="dialog" aria-label={`${picked.name}`}>
            <div className="nv-pick-head">
              <span className="nv-pick-icon" aria-hidden="true"><MapPin size={16} /></span>
              <span className="nv-pick-text"><strong>{roomName(picked)}</strong><small>{picked.category}, {picked.floor} этаж</small></span>
              <button type="button" className="nv-pick-close" onClick={() => setPicked(null)} aria-label="Закрыть"><X size={16} /></button>
            </div>
            <div className="nv-pick-actions">
              <button type="button" className="nv-pick-go" onClick={() => pickAs('to')} disabled={picked.id === target.id}><Flag size={14} /> Сюда</button>
              <button type="button" onClick={() => pickAs('from')} disabled={picked.id === startId}><Navigation size={14} /> Отсюда</button>
              <Link to={`/ai?about=${encodeURIComponent(picked.id)}`} title="Спросить ЛОГОС AI про это место"><MessageCircle size={14} /> Спросить</Link>
            </div>
          </div>}
          <div className="nv-map-tools">
            {legCross && <div className="nv-floors" role="group" aria-label="Этаж на карте">
              {[shownLeg.fromRoom.floor, shownLeg.toRoom.floor].map((floor) => <button type="button" key={floor} aria-pressed={shownFloor === floor} onClick={() => setPeek({ key: peekKey, floor })}>{`${floor} этаж`}</button>)}
            </div>}
            <div className="nv-view" role="group" aria-label="Вид карты">
              <button type="button" aria-pressed={mode3d} onClick={() => setMode3d(true)}>3D</button>
              <button type="button" aria-pressed={!mode3d} onClick={() => setMode3d(false)}>Сверху</button>
            </div>
          </div>
          {!followsStep && <button type="button" className="nv-back-to-step" onClick={() => setPeek({ key: '', floor: null })}>Вернуться к шагу {stepIndex + 1}</button>}
        </div>

        <div className="nv-controls">
          <button type="button" className="nv-ctl" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0} aria-label="Предыдущий шаг"><ArrowLeft size={18} /></button>
          <div className="nv-progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
          <button type="button" className="nv-ctl" onClick={repeatStep} aria-label="Повторить подсказку голосом" title="Повторить голосом"><Volume2 size={17} /></button>
          {stepIndex < steps.length - 1
            ? <button type="button" className="nv-next" onClick={() => goToStep(stepIndex + 1)}>Дальше <ArrowRight size={17} /></button>
            : <button type="button" className="nv-next nv-next-done" onClick={arrive}><Check size={17} /> Я на месте</button>}
        </div>
        <p className="nv-footnote"><Link to={mapUrl}>Открыть на карте <ArrowUpRight size={13} /></Link> Маршрут построен по плану. Если проход закрыт, следуйте указателям в здании.<span className="nv-keys"> Стрелки ← → на клавиатуре листают шаги.</span></p>
      </section>
    </div>
    {walking && <WalkMode steps={steps} index={stepIndex} onStep={(index) => goToStep(index)} onRepeat={repeatStep} onClose={() => setWalking(false)} onArrive={arrive} target={target} stop={via}>
      <RouteScene floor={shownFloor} points={leg?.points || []} progress={followsStep ? current.progress : null} following={followsStep} mode="top" targetId={shownLeg.toRoom.id} transfer={transferMarks} notices={notices} />
    </WalkMode>}
    {sharing && <ShareRoute onClose={() => setSharing(false)} from={startId === 'manual' ? 'entrance-1' : startId} to={target.id} via={via?.id || ''} mode={routePreference} title={`${startLabel} → ${roomName(target)}`} meta={`${sameRoom ? 'Вы уже на месте' : `≈ ${Math.round(route.meters)} м, ${route.seconds < 60 ? 'меньше минуты' : `${minutes(route.seconds)} мин`}`}${crossFloor ? `, ${viaLabel}` : ''}`} steps={steps} manualStart={startId === 'manual'} />}
  </div>
}
