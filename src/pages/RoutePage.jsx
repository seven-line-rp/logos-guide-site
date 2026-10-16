import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, ArrowUp, ArrowUpRight, Check, Footprints, Info, MapPin, MoveDown, MoveUp, Play, Volume2, VolumeX, X } from 'lucide-react'
import { rooms } from '../data.js'
import { FloorTag, PageHeading, Reveal } from '../components/Primitives.jsx'
import FloorMap from '../components/FloorMap.jsx'
import RoomSearchSelect from '../components/RoomSearchSelect.jsx'
import { buildRouteOptions, pickRoute } from '../map-routing.js'
import { buildRouteSteps } from '../route-steps.js'
import { readManualLocation } from '../map-location.js'
import { VOICE_PRESETS, getAvailableVoices, getStoredPreset, loadVoices, primeSpeech, setVoicePreset, speakText, stopSpeech } from '../speech.js'
import { VOICE_PACK_MALE_ID, playVoicePack, primeVoicePack, stopVoicePack, voicePackForPreset } from '../voice-pack.js'
import { storageGet, storageSet } from '../storage.js'

function roomName(room) { return `${room.name}${room.number ? ` №${room.number}` : ''}` }
function stepLabel(count) { return `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'шаг' : count % 10 >= 2 && count % 10 <= 4 && !(count % 100 >= 12 && count % 100 <= 14) ? 'шага' : 'шагов'}` }
function timeLabel(seconds) { return seconds < 60 ? 'меньше минуты' : `≈ ${Math.max(1, Math.round(seconds / 60))} мин` }

export default function RoutePage() {
  const [params] = useSearchParams()
  const manualPoint = readManualLocation(storageGet('map-manual-point'))
  const [startId, setStartId] = useState(() => params.get('from') === 'manual' && manualPoint ? 'manual' : rooms.some((room) => room.id === params.get('from')) ? params.get('from') : 'entrance-1')
  const [targetId, setTargetId] = useState(() => rooms.some((room) => room.id === params.get('to')) ? params.get('to') : 'auditorium-104')
  // Какой вариант маршрута выбрал пользователь: 'auto' — самый быстрый,
  // 'stairs' — любая ближайшая лестница, либо точный вид ('lift',
  // 'stairs-west', 'stairs-middle', 'stairs-north').
  const [routePreference, setRoutePreference] = useState(() => params.get('mode') === 'stairs' ? 'stairs' : 'auto')
  const start = startId === 'manual' && manualPoint ? manualPoint : rooms.find((room) => room.id === startId) || rooms.find((room) => room.id === 'entrance-1')
  const target = rooms.find((room) => room.id === targetId) || rooms[0]
  const startLabel = startId === 'manual' ? 'Ваша отметка' : roomName(start)
  const crossFloor = start.floor !== target.floor
  // Варианты маршрута, как в навигаторе: лифт и три лестницы с метриками.
  // Быстрый всегда первый; выбранный вариант хранится в routePreference.
  const routeOptions = useMemo(() => buildRouteOptions(startId === 'manual' && manualPoint ? manualPoint : start.id, target.id), [startId, start.id, target.id, manualPoint])
  const route = useMemo(() => pickRoute(routeOptions, routePreference), [routeOptions, routePreference])
  const transition = route.transfer?.kind === 'lift' || !route.transfer ? 'lift' : route.transfer.kind
  const sameRoom = !crossFloor && route.length === 0
  // Каждый шаг знает свой этаж и вершину маршрута: по ним на плане двигается
  // точка, а пройденная часть линии остаётся бледной (см. src/route-steps.js).
  const steps = buildRouteSteps({
    startLabel,
    startFloor: start.floor,
    targetFloor: target.floor,
    targetName: roomName(target),
    route,
    sameRoom,
  })

  const routeKey = [startId, target.id, route.kind || 'same'].join('|')
  const [nav, setNav] = useState({ key: routeKey, index: 0 })
  const stepIndex = nav.key === routeKey ? Math.min(nav.index, steps.length - 1) : 0
  // Голос включён по умолчанию: первую фразу пользователь всё равно слышит
  // только после нажатия кнопки, поэтому автозапуск браузер не блокирует.
  const [voiceOn, setVoiceOn] = useState(() => storageGet('route-voice') === 'on' || storageGet('route-voice') === null)
  const [voiceNotice, setVoiceNotice] = useState('')
  const [voicePreset, setVoicePresetState] = useState(() => storageGet('route-voice-preset') || getStoredPreset())
  const [systemVoices, setSystemVoices] = useState([])
  const [mode3d, setMode3d] = useState(true)
  const [swoop, setSwoop] = useState(false)

  const current = steps[stepIndex]
  const stepIcon = (step) => step.kind === 'start' ? MapPin : step.kind === 'arrive' ? Check : step.kind === 'transfer' ? (step.title.startsWith('Поднимитесь') ? MoveUp : MoveDown) : Footprints
  const CurrentIcon = stepIcon(current)

  // Голоса браузера грузятся асинхронно — прогреваем синтезатор заранее,
  // иначе первая же подсказка уходит в пустоту и её не слышно.
  useEffect(() => {
    if (voiceOn) primeSpeech()
    loadVoices().then(() => {
      setSystemVoices(getAvailableVoices())
    })
  }, [voiceOn])

  // Если браузер не может говорить по-русски, пользователь должен понять,
  // что дело в системе, а не в сайте.
  const reportVoice = (result) => {
    if (result === 'unsupported') setVoiceNotice('Браузер не умеет синтез речи — озвучка недоступна, подсказки можно читать на экране.')
    else if (result === 'foreign-voice' || result === 'no-voice') setVoiceNotice('В системе нет русского голоса: речь звучит с акцентом или молчит. Добавьте русский голос в настройках телефона или компьютера.')
    else setVoiceNotice('')
  }
  const packVoiceActive = () => voicePackForPreset(voicePreset) !== null
  // Записанных пакетов два: женский и мужской.
  const packVoice = () => (voicePreset === VOICE_PACK_MALE_ID ? 'male' : 'female')
  // Названия кабинетов в пакете не записаны — их читает синтезатор тем
  // голосом, который был выбран до переключения на записанную озвучку.
  const fallbackTtsPreset = () => {
    const stored = storageGet('route-voice-tts-preset')
    return VOICE_PRESETS.some((preset) => preset.id === stored && !voicePackForPreset(preset.id)) ? stored : 'female'
  }

  // Озвучка шага: у шага есть voiceCue со списком записанных фраз навигатора.
  // Если пакета нет или фраза не загрузилась — шаг читает синтезатор браузера.
  const speakStep = (step) => {
    if (!voiceOn) return
    if (packVoiceActive()) {
      const keys = step.voiceCue || []
      if (keys.length) {
        playVoicePack(keys, { voice: packVoice() }).then((result) => {
          if (result === 'played') setVoiceNotice('')
          else if (result === 'unavailable') {
            setVoiceNotice('Записанная озвучка не поддерживается браузером — подсказки читает системный голос.')
            speakText(step.say, { preset: fallbackTtsPreset() }).then(reportVoice)
          } else {
            speakText(step.say, { preset: fallbackTtsPreset() }).then(reportVoice)
          }
        })
        return
      }
    }
    speakText(step.say, { preset: packVoiceActive() ? fallbackTtsPreset() : voicePreset }).then(reportVoice)
  }
  const goToStep = (index, withVoice = true) => {
    const next = Math.max(0, Math.min(steps.length - 1, index))
    setNav({ key: routeKey, index: next })
    if (withVoice) speakStep(steps[next])
  }
  const toggleVoice = () => {
    const next = !voiceOn
    setVoiceOn(next)
    storageSet('route-voice', next ? 'on' : 'off')
    if (!next) { stopSpeech(); stopVoicePack(); setVoiceNotice('') }
    else {
      primeSpeech()
      if (packVoiceActive()) {
        primeVoicePack()
        playVoicePack(['route-built'], { voice: packVoice() }).then((result) => {
          if (result !== 'played') speakText(steps[stepIndex].say, { preset: fallbackTtsPreset() }).then(reportVoice)
        })
      } else {
        speakText(steps[stepIndex].say, { preset: voicePreset }).then(reportVoice)
      }
    }
  }

  const handleVoicePresetChange = (presetId) => {
    // Запомнить синтезаторный голос для фраз с названиями кабинетов.
    if (!voicePackForPreset(voicePreset) && voicePreset !== presetId) storageSet('route-voice-tts-preset', voicePreset)
    setVoicePresetState(presetId)
    setVoicePreset(presetId)
    storageSet('route-voice-preset', presetId)
    if (voiceOn) {
      if (voicePackForPreset(presetId)) {
        primeVoicePack()
        playVoicePack(['route-built'], { voice: packVoice() }).then((result) => {
          if (result !== 'played') speakText('Голос изменён.', { preset: fallbackTtsPreset() }).then(reportVoice)
        })
      } else {
        speakText('Голос изменён.', { preset: presetId }).then(reportVoice)
      }
    }
  }

  const testVoice = () => {
    if (!voiceOn) {
      setVoiceOn(true)
      storageSet('route-voice', 'on')
      primeSpeech()
    }
    if (voicePackForPreset(voicePreset)) {
      primeVoicePack()
      playVoicePack(['route-built', 'corridor-1-east'], { voice: packVoice() }).then((result) => {
        if (result !== 'played') speakText('Маршрут построен. Следуйте прямо по коридору.', { preset: fallbackTtsPreset() }).then(reportVoice)
      })
      return
    }
    const sample = voicePreset === 'navigator'
      ? 'Маршрут построен. Поехали! Следуйте прямо по коридору.'
      : 'Маршрут построен. Следуйте прямо по коридору до нужной двери.'
    speakText(sample, { preset: voicePreset }).then(reportVoice)
  }

  // «Повторить» работает и при выключенном голосе: нажатие — это явное
  // намерение услышать подсказку, поэтому голос включаем сами.
  const repeatStep = () => {
    if (!voiceOn) { setVoiceOn(true); storageSet('route-voice', 'on'); primeSpeech(); primeVoicePack() }
    speakStep(current)
  }

  const planRoute = (event) => {
    event.preventDefault()
    setNav({ key: routeKey, index: 0 })
    setMode3d(true)
    setSwoop(true)
    primeVoicePack()
    document.getElementById('route-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => setSwoop(false), 1100)
    if (voiceOn && voicePackForPreset(voicePreset)) {
      playVoicePack(['route-built'], { voice: packVoice() }).then((result) => {
        if (result === 'played') speakStep(steps[0])
        else speakText(`Маршрут построен. ${steps[0].say}`, { preset: fallbackTtsPreset() }).then(reportVoice)
      })
      return
    }
    const intro = voicePreset === 'navigator'
      ? `Маршрут построен. Поехали! ${steps[0].say}`
      : `Маршрут построен. ${steps[0].say}`
    if (voiceOn) speakText(intro, { preset: voicePreset }).then(reportVoice)
  }
  const resetRoute = () => { setStartId('entrance-1'); setTargetId('auditorium-104'); setRoutePreference('auto') }
  const mapUrl = `/map?floor=${target.floor}&from=${encodeURIComponent(startId)}&to=${encodeURIComponent(target.id)}${crossFloor ? `&mode=${transition}` : ''}`

  const activeStepPoint = useMemo(() => {
    const leg = route.byFloor[current.floor]
    if (current.progress !== null && leg?.points?.[current.progress]) {
      return leg.points[current.progress]
    }
    return leg?.points?.[0] || null
  }, [current.floor, current.progress, route.byFloor])

  return <>
    <PageHeading eyebrow="Маршрут по колледжу" title={<>Откуда идёте?<br /><em>Куда нужно попасть?</em></>} description="Выберите старт и кабинет. Покажем путь по коридорам и, если нужно, переход на другой этаж." />
    <section className="route-builder container">
      <Reveal className="route-form-panel"><div className="route-form-header"><span className="eyebrow">Точки маршрута</span><span className="route-form-step">1 / 2</span></div><form onSubmit={planRoute}>
        <RoomSearchSelect
          label="Откуда"
          value={startId}
          onChange={setStartId}
          manualOption={manualPoint ? { value: 'manual', label: `Ваша отметка · ${manualPoint.floor} этаж` } : null}
        />
        <Link className="route-manual-link" to={`/map?floor=${start.floor}&manual=1`}><MapPin size={15} /> {manualPoint ? 'Изменить отметку на плане' : 'Отметить точку на плане'}</Link>
        <div className="route-connector"><span /><i /><span /></div>
        <RoomSearchSelect
          label="Куда"
          value={targetId}
          onChange={setTargetId}
        />
        <button className="button button-primary route-submit" type="submit">Посмотреть маршрут <ArrowRight size={16} /></button>
      </form></Reveal>
      <Reveal id="route-result" className="route-result-panel" delay={100}><div className="route-result-top"><span className="eyebrow">Ваш маршрут</span><div className="route-top-actions"><button className="route-reset" type="button" onClick={resetRoute}><X size={14} /> Сбросить</button></div></div>
        
        {/* Панель озвучки с выбором женского, мужского, навигатора и проверкой */}
        <div className="route-voice-bar">
          <div className="route-voice-selector-wrap">
            <label htmlFor="route-voice-select"><Volume2 size={15} /> <strong>Озвучка:</strong></label>
            <select
              id="route-voice-select"
              value={voicePreset}
              onChange={(e) => handleVoicePresetChange(e.target.value)}
              className="route-voice-select"
              aria-label="Выбор голоса озвучки"
            >
              <optgroup label="Варианты озвучки">
                {VOICE_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </optgroup>
              {systemVoices.length > 0 && (
                <optgroup label="Системные русские голоса">
                  {systemVoices.map((v) => (
                    <option key={v.name} value={`sys:${v.name}`}>{v.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button
              type="button"
              className="route-voice-test-button"
              onClick={testVoice}
              title="Прослушать пример голоса"
            >
              <Play size={12} fill="currentColor" /> Прослушать
            </button>
          </div>
          <button
            className={`route-voice-toggle ${voiceOn ? 'route-voice-on' : ''}`}
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceOn}
          >
            {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>Голос {voiceOn ? 'вкл' : 'выкл'}</span>
          </button>
        </div>

        <div className="route-endpoints"><div><span>Старт</span><strong>{startLabel}</strong><FloorTag floor={start.floor} /></div><div className="route-end-arrow"><ArrowRight size={19} /></div><div><span>Финиш</span><strong>{roomName(target)}</strong><FloorTag floor={target.floor} /></div></div>
        <div className="route-distance"><span><Footprints size={16} /> Пешком</span><span>{crossFloor ? `Переход: ${route.transfer?.label}` : 'Один этаж'}</span><span>≈ {Math.round(route.meters)} м · ~{stepLabel(route.footsteps)}</span><span>{timeLabel(route.seconds)}</span><span>{stepLabel(steps.length)}</span></div>

        {/* Варианты маршрута, как в навигаторе: лифт и три лестницы,
            быстрый отмечен. У каждого — расстояние, время и число шагов. */}
        {routeOptions.length > 1 && <div className="route-options" role="group" aria-label="Варианты маршрута">
          <span className="route-options-label">Варианты маршрута</span>
          {routeOptions.map((option, index) => <button type="button" key={option.kind} className={`route-option-card ${route === option ? 'route-option-active' : ''}`} onClick={() => setRoutePreference(option.kind)} aria-pressed={route === option}>
            <span className="route-option-icon">{option.kind === 'lift' ? <MoveUp size={16} /> : <ArrowUp size={16} />}</span>
            <span className="route-option-body"><strong>{option.label}</strong><small>≈ {Math.round(option.meters)} м · {timeLabel(option.seconds)} · ~{stepLabel(option.footsteps)}</small></span>
            {index === 0 && <em className="route-option-badge">Быстрее</em>}
          </button>)}
        </div>}
        
        {/* HUD Яндекс.Навигатора с подсказкой манёвра и переключателем 3D-камеры */}
        <div className="yandex-nav-hud">
          <div className="yandex-hud-left">
            <span className="yandex-hud-icon"><CurrentIcon size={24} /></span>
            <div className="yandex-hud-text">
              <div className="yandex-hud-eyebrow">
                <span>Шаг {stepIndex + 1} из {steps.length}</span>
                <span>·</span>
                <span>{current.floor} этаж</span>
              </div>
              <strong className="yandex-hud-title">{current.title}</strong>
              <span className="yandex-hud-detail">{current.detail}</span>
            </div>
          </div>
          <div className="yandex-hud-right">
            <button
              type="button"
              className={`yandex-hud-3d-btn ${mode3d ? 'is-3d' : 'is-2d'}`}
              onClick={() => setMode3d((v) => !v)}
              aria-pressed={mode3d}
              title={mode3d ? 'Переключить в 2D (вид сверху)' : 'Переключить в 3D (вид навигатора)'}
            >
              <span className="yandex-3d-badge">{mode3d ? '3D' : '2D'}</span>
              <span>{mode3d ? 'Камера' : 'Сверху'}</span>
            </button>
          </div>
        </div>

        {/* Превью этажей. В 2D маршрут между этажами показан двумя планами
            рядом (как раньше), а в 3D-режиме камера идёт по этажам по
            очереди: сначала этаж старта, а второй план «включается» в момент
            перехода — иначе две наклонённые перспективы рядом выглядят
            тесно и нечитаемо. */}
        {crossFloor && mode3d ? (
          <div className="route-preview-grid route-preview-single">
            <div className="route-single-stack">
              {[start.floor, target.floor].map((floorNumber) => {
                const isActive = current.floor === floorNumber
                const isStartFloor = floorNumber === start.floor
                return (
                  <div key={floorNumber} className={`route-single-layer ${isActive ? 'route-single-visible' : ''}`} inert={!isActive}>
                    <div className="route-preview-caption">
                      <span>{floorNumber} этаж</span>
                      <small>{isStartFloor ? `До ${route.transfer?.toward}` : `От ${route.transfer?.toward} до кабинета`}{isActive ? ` · шаг ${stepIndex + 1}` : ''}</small>
                    </div>
                    <div className="route-preview-panel">
                      <FloorMap
                        floor={floorNumber}
                        compact
                        selectedId={isStartFloor ? route.transfer?.startId : target.id}
                        routeStart={isStartFloor ? (startId === 'manual' ? manualPoint : start.id) : route.transfer?.endId}
                        routeTargetId={isStartFloor ? route.transfer?.startId : target.id}
                        transition={transition}
                        manualPoint={isStartFloor && startId === 'manual' ? manualPoint : null}
                        routeProgress={isActive ? current.progress : null}
                        navMode3d={isActive}
                        onToggle3d={() => setMode3d((v) => !v)}
                        activeStepPoint={isActive ? activeStepPoint : null}
                        swoopActive={swoop && isActive}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="route-single-strip" aria-hidden="true">
              <span className={current.floor === start.floor ? 'route-strip-active' : ''}>{start.floor} этаж</span>
              <span className="route-strip-path"><i /><em>{route.transfer?.label}</em><i /></span>
              <span className={current.floor === target.floor ? 'route-strip-active' : ''}>{target.floor} этаж</span>
            </div>
            <p className="route-single-hint">3D-камера показывает этажи по очереди: второй план откроется на шаге перехода. Нужны оба плана рядом — включите вид «Сверху» (2D).</p>
          </div>
        ) : (
        <div className={`route-preview-grid ${crossFloor ? 'route-preview-two' : ''}`}>
          <div className={`route-preview-floor ${current.floor === start.floor ? 'route-floor-active' : ''}`}>
            <div className="route-preview-caption">
              <span>{start.floor} этаж</span>
              <small>{crossFloor ? `До ${route.transfer?.toward}` : 'Путь по этажу'}{current.floor === start.floor ? ` · шаг ${stepIndex + 1}` : ''}</small>
            </div>
            <div className="route-preview-panel">
              <FloorMap
                floor={start.floor}
                compact
                selectedId={crossFloor ? route.transfer?.startId : target.id}
                routeStart={startId === 'manual' ? manualPoint : start.id}
                routeTargetId={crossFloor ? route.transfer?.startId : target.id}
                transition={transition}
                manualPoint={startId === 'manual' ? manualPoint : null}
                routeProgress={current.floor === start.floor ? current.progress : null}
                navMode3d={mode3d && current.floor === start.floor}
                onToggle3d={() => setMode3d((v) => !v)}
                activeStepPoint={current.floor === start.floor ? activeStepPoint : null}
                swoopActive={swoop}
              />
            </div>
          </div>
          {crossFloor && (
            <div className={`route-preview-floor ${current.floor === target.floor ? 'route-floor-active' : ''}`}>
              <div className="route-preview-caption">
                <span>{target.floor} этаж</span>
                <small>От {route.transfer?.toward} до кабинета{current.floor === target.floor ? ` · шаг ${stepIndex + 1}` : ''}</small>
              </div>
              <div className="route-preview-panel">
                <FloorMap
                  floor={target.floor}
                  compact
                  selectedId={target.id}
                  routeStart={route.transfer?.endId}
                  routeTargetId={target.id}
                  transition={transition}
                  routeProgress={current.floor === target.floor ? current.progress : null}
                  navMode3d={mode3d && current.floor === target.floor}
                  onToggle3d={() => setMode3d((v) => !v)}
                  activeStepPoint={current.floor === target.floor ? activeStepPoint : null}
                  swoopActive={swoop}
                />
              </div>
            </div>
          )}
        </div>
        )}
        {voiceNotice && <p className="route-voice-notice" role="status"><Info size={14} /> {voiceNotice}</p>}
        <div className="route-nav" aria-live="polite"><div className="route-nav-main"><span className="route-nav-icon"><CurrentIcon size={22} /></span><div><small>Шаг {stepIndex + 1} из {steps.length}</small><strong>{current.title}</strong><em>{current.detail}</em></div></div><div className="route-progress" aria-hidden="true"><span style={{ width: `${(stepIndex + 1) / steps.length * 100}%` }} /></div><div className="route-nav-controls"><button type="button" onClick={() => goToStep(stepIndex - 1)} disabled={stepIndex === 0}><ArrowLeft size={16} /> Назад</button><button type="button" className={voiceOn ? '' : 'route-nav-voice-off'} onClick={repeatStep} aria-label="Повторить подсказку голосом"><Volume2 size={16} /> Повторить</button><button type="button" onClick={() => goToStep(stepIndex + 1)} disabled={stepIndex >= steps.length - 1}>Дальше <ArrowRight size={16} /></button></div></div>
        <div className="route-steps">{steps.map((step, index) => { const Icon = stepIcon(step); return <button type="button" className={`route-step ${index === stepIndex ? 'route-step-current' : ''} ${index < stepIndex ? 'route-step-past' : ''}`} key={`${step.title}-${index}`} onClick={() => goToStep(index)} aria-current={index === stepIndex}><span className="route-step-index"><Icon size={15} /></span><div><strong>{step.title}</strong><small>{step.detail}</small></div><span className="route-step-count">{index < stepIndex ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span></button> })}</div>
        <div className="route-result-actions"><Link className="button button-primary" to={mapUrl}>Показать на карте <ArrowUpRight size={15} /></Link><Link className="route-other-link" to="/rooms">Справочник кабинетов <ArrowRight size={14} /></Link></div>
      </Reveal>
    </section>
    <section className="route-hint-band"><div className="container route-hint-inner"><span className="route-hint-icon">i</span><div><strong>О навигаторе колледжа</strong><p>Маршрут работает в режиме 3D-навигатора с видом камеры по направлению движения. На маршрутах между этажами 3D-камера показывает этажи по очереди: сначала этаж старта, второй — в момент перехода; в виде «Сверху» (2D) оба плана остаются рядом. Озвучка — на выбор: записанные фразы в стиле 2ГИС (не зависят от голосов системы), женский, мужской или диктор-навигатор. Кабинет в поле поиска находится по названию, номеру или слову-псевдониму.</p></div><Link to="/map">Карта этажей <ArrowRight size={14} /></Link></div></section>
  </>
}
