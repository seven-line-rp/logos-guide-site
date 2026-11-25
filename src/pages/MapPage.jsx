import { useTheme } from '../theme.js'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Bluetooth, Box, Building2, Compass, DoorOpen, LocateFixed, LocateOff, MapPin, Navigation, Settings2, Square, TriangleAlert, X, ZoomIn, ZoomOut } from 'lucide-react'
import { categoryLabels, floors, photosFor, rooms } from '../data.js'
import FloorMap from '../components/FloorMap.jsx'
import RouteScene from '../components/RouteScene.jsx'
import RoomSearchSelect from '../components/RoomSearchSelect.jsx'
import { calculateIndoorRoute } from '../map-routing.js'
import FavoriteButton from '../components/FavoriteButton.jsx'
import MeetButton from '../components/MeetButton.jsx'
import ReportProblem from '../components/ReportProblem.jsx'
import RoomInfo from '../components/RoomInfo.jsx'
import RoomPhoto from '../components/RoomPhoto.jsx'
import { NOTICE_TYPES, useNotices } from '../notices.js'
import { FloorTag } from '../components/Primitives.jsx'
import { isInsidePlan, planRoomBounds } from '../map-geometry.js'
import { GPS_GOOD_ACCURACY, GPS_SHOW_LIMIT, addGpsAnchor, readGpsAnchors, readManualLocation } from '../map-location.js'
import { requestCompass } from '../use-location.js'
import { useLivePosition } from '../use-live-position.js'
import { bluetoothSupport, disableBluetooth, enableBluetooth } from '../bluetooth-location.js'
import { useSiteSettings } from '../site-settings.js'
import { storageGet, storageRemove, storageSet } from '../storage.js'
import { readMapContrast, setMapContrast } from '../map-contrast.js'

const FloorPanorama = lazy(() => import('../components/FloorPanorama.jsx'))

const hasTouch = typeof window !== 'undefined' && 'ontouchstart' in window
const otherFloor = (floor) => floor === 1 ? 2 : 1
// Вид перехода может быть общим (stairs/lift) или точным — какой именно
// вариант маршрута выбрал пользователь на странице маршрута.
const routeModes = ['lift', 'stairs', 'stairs-west', 'stairs-middle', 'stairs-north']
const roomTitle = (room) => `${room.name}${room.number ? ` №${room.number}` : ''}`
const roomCenter = (room) => {
  const [x, y, width, height] = planRoomBounds[room.id]
  return { floor: room.floor, x: x + width / 2, y: y + height / 2 }
}

export default function MapPage() {
  const [params, setParams] = useSearchParams()
  const floor = Number(params.get('floor')) === 2 ? 2 : 1
  const routeModeParam = routeModes.includes(params.get('mode')) ? params.get('mode') : 'lift'
  const selectedId = params.get('room') || params.get('to') || ''
  const selected = rooms.find((room) => room.id === selectedId && room.floor === floor)
  const floorRooms = useMemo(() => rooms.filter((room) => room.floor === floor), [floor])
  const [filter, setFilter] = useState('Все места')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showLabels, setShowLabels] = useState(() => storageGet('map-show-labels') !== 'false')
  const [showDoorMarks, setShowDoorMarks] = useState(() => storageGet('map-show-doors') !== 'false')
  const [contrast, setContrast] = useState(readMapContrast)
  const toggleContrast = (on) => { setContrast(on); setMapContrast(on) }
  const [zoomed, setZoomed] = useState(() => window.matchMedia('(max-width: 680px)').matches)
  const theme = useTheme()
  const [panorama, setPanorama] = useState(false)
  const [mode3d, setMode3d] = useState(false)
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [gpsAnchors, setGpsAnchors] = useState(() => readGpsAnchors(storageGet('map-gps-anchors')))
  // GPS, компас и Bluetooth-маячки вместе: где GPS слабый, место берётся по маячку.
  const { marker: gpsMarker, gps, located, ble, compassHeading } = useLivePosition(gpsEnabled, floor, gpsAnchors)
  const { beacons } = useSiteSettings()
  const bleSupport = useMemo(() => bluetoothSupport(), [])
  const canBluetooth = beacons.length > 0 && bleSupport !== 'none'
  const [manualPoint, setManualPoint] = useState(() => {
    const saved = readManualLocation(storageGet('map-manual-point'))
    if (saved) return saved
    const oldRoom = rooms.find((room) => room.id === storageGet('map-manual-location'))
    return oldRoom ? roomCenter(oldRoom) : null
  })
  const [picking, setPicking] = useState(() => params.get('manual') === '1' ? 'manual' : '')
  const [pointFeedback, setPointFeedback] = useState('')
  const [centerOn, setCenterOn] = useState(null)
  const fromParam = params.get('from') || ''
  const routeStart = fromParam === 'manual' ? manualPoint : fromParam || (selected && manualPoint ? manualPoint : '')
  const routeTargetId = params.get('to') || selected?.id || ''
  const notices = useNotices()
  const floorNotices = notices.filter((notice) => rooms.find((room) => room.id === notice.roomId)?.floor === floor)
  const selectedNotices = notices.filter((notice) => notice.roomId === selected?.id)
  const scenePoints = useMemo(() => routeStart && routeTargetId ? calculateIndoorRoute(routeStart, routeTargetId, floor, routeModeParam).points || [] : [], [routeStart, routeTargetId, floor, routeModeParam])
  const stair = selected?.id.match(/^(stairs-(?:north|middle|west))-[12]$/)

  // Маячок знает этаж: если он на другом, показываем тот этаж.
  const bleFloor = gpsMarker?.source === 'bluetooth' ? gpsMarker.floor : null
  useEffect(() => {
    if (bleFloor && bleFloor !== floor) chooseFloor(bleFloor)
    // chooseFloor меняет только адрес страницы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bleFloor])
  // Первая точка — сразу показываем её на плане.
  const centeredOnce = useRef(false)
  useEffect(() => {
    if (!gpsMarker || gpsMarker.floor !== floor || centeredOnce.current) return
    centeredOnce.current = true
    setCenterOn({ floor, point: gpsMarker.point, key: Date.now() })
  }, [gpsMarker, floor])

  useEffect(() => {
    storageSet('map-show-labels', String(showLabels))
    storageSet('map-show-doors', String(showDoorMarks))
  }, [showLabels, showDoorMarks])
  useEffect(() => {
    if (manualPoint) storageSet('map-manual-point', JSON.stringify(manualPoint))
    else storageRemove('map-manual-point')
    storageRemove('map-manual-location')
  }, [manualPoint])
  useEffect(() => { storageSet('map-gps-anchors', JSON.stringify(gpsAnchors)) }, [gpsAnchors])

  const chooseFloor = (nextFloor, room = null, clear = false) => {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('floor', String(nextFloor))
      if (room) next.set('room', room.id)
      else next.delete('room')
      if (clear) { next.delete('from'); next.delete('to') }
      next.delete('manual')
      return next
    }, { replace: true })
  }
  const selectRoom = (room) => {
    if (!room) return
    if (picking) { placePoint(roomCenter(room)); return }
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set('floor', String(room.floor))
      next.set('room', room.id)
      if (next.has('from') || next.has('to')) next.set('to', room.id)
      return next
    }, { replace: true })
  }
  const placePoint = (point) => {
    if (!isInsidePlan(point.floor, [point.x, point.y], rooms)) {
      setPointFeedback('Эта точка вне помещений и коридоров. Коснитесь плана внутри здания.')
      return
    }
    if (picking === 'gps') {
      if (!gps.coords) return
      const next = addGpsAnchor(gpsAnchors, point.floor, point, gps.coords)
      if (next === gpsAnchors) {
        setPointFeedback('Для второй точки отойдите хотя бы на 3 метра и попробуйте снова.')
        return
      }
      setGpsAnchors(next)
      setPointFeedback(next[point.floor].length === 1 ? 'Первая точка запомнена. Перейдите к другому известному месту и отметьте его.' : 'Готово: на этом этаже GPS считается по вашим двум точкам.')
    } else {
      setManualPoint(point)
      setPointFeedback('Метка поставлена. Теперь выберите, куда идти.')
    }
    setPicking('')
    if (params.has('manual')) setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.delete('manual')
      return next
    }, { replace: true })
  }
  const locate = async () => {
    if (gpsEnabled && gpsMarker) { setCenterOn({ floor, point: gpsMarker.point, key: Date.now() }); return }
    if (gpsEnabled) return
    setMode3d(false)
    centeredOnce.current = false
    requestCompass() // iPhone спрашивает разрешение на компас только по нажатию
    setGpsEnabled(true)
    // Слушать маячки браузер разрешает только по нажатию, поэтому включаем сразу.
    if (canBluetooth && bleSupport === 'scan') void enableBluetooth()
  }
  const stopGps = () => {
    setGpsEnabled(false)
    disableBluetooth()
    if (picking === 'gps') setPicking('')
  }
  const useGpsAsStart = () => {
    if (!gpsMarker) return
    setManualPoint({ floor: gpsMarker.floor, x: Math.round(gpsMarker.point[0] * 10) / 10, y: Math.round(gpsMarker.point[1] * 10) / 10 })
    setPointFeedback('Ваше место стало началом маршрута. Выберите, куда идти.')
  }

  const accuracy = Math.round(gps.coords?.accuracy || 0)
  const byBluetooth = gpsMarker?.source === 'bluetooth'
  const bleOn = ble.status === 'on'
  // Что предложить про Bluetooth, когда GPS не справляется.
  const bleHint = !canBluetooth ? '' : bleOn ? (ble.heard ? '' : ' Bluetooth включён, но маячков рядом не слышно.') : ' Попробуйте Bluetooth: рядом с маячком место определится без GPS.'
  const gpsInfo = (() => {
    if (!gpsEnabled && gps.status === 'idle') return null
    if (byBluetooth) return { tone: 'ok', text: `Вы здесь, ${gpsMarker.floor} этаж. Место по Bluetooth-маячк${ble.fix?.count > 1 ? 'ам' : 'у'}, точность ±${Math.max(1, Math.round(gpsMarker.accuracy))} м.`, ok: true }
    if (gps.status === 'loading') return { tone: 'wait', text: 'Ищем вас. Если браузер спросит, разрешите доступ к геопозиции.' }
    if (gps.status === 'denied') return { tone: 'bad', text: `Нет доступа к геопозиции. Разрешите его для сайта в настройках браузера или поставьте метку вручную.${bleHint}` }
    if (gps.status === 'unsupported') return { tone: 'bad', text: 'Этот браузер не даёт сайту геопозицию. Откройте logos-guide.ru по https в Chrome или Safari.' }
    if (gps.status === 'timeout' || gps.status === 'unavailable') return { tone: 'bad', text: `Телефон не смог определить место. Включите геолокацию в шторке, подойдите к окну или поставьте метку вручную.${bleHint}` }
    if (!located) return { tone: 'wait', text: 'Получили координаты, считаем место на плане.' }
    if (!located.inside) return { tone: 'warn', text: located.distance > 1 ? `Вы примерно в ${Math.round(located.distance)} м от корпуса. Метка появится, когда зайдёте внутрь.` : 'Вы рядом с корпусом. Метка появится, когда зайдёте внутрь.' }
    if (!gpsMarker) return { tone: 'warn', text: `Сигнал GPS слабый, точность ±${accuracy} м. Подойдите к окну: метка появится, когда станет точнее ${GPS_SHOW_LIMIT} м.${bleHint}` }
    return { tone: accuracy <= GPS_GOOD_ACCURACY ? 'ok' : 'warn', text: `Вы здесь, точность ±${accuracy} м. Телефон не знает этаж, поэтому показываем ${floor}-й.${accuracy > GPS_GOOD_ACCURACY ? bleHint : ''}`, ok: true }
  })()
  const bleNote = ble.status === 'denied' ? 'Браузер не дал доступ к Bluetooth. Разрешите его для сайта и нажмите ещё раз.'
    : ble.status === 'error' ? 'Bluetooth не запустился. Проверьте, что он включён на телефоне.'
    : ''

  const popular = floorRooms.filter((room) => room.category === 'Общие пространства' && !/^(stairs|lift|elevator|entrance|exit|wc|toilet)/.test(room.id)).slice(0, 4)

  const inPanorama = theme === 'v2' && panorama && !picking
  return <section className="map-page-section mp container">
    <header className="mp-head">
      <div className="mp-title">
        <h1>Карта этажей</h1>
        <p>Найдите кабинет или коснитесь его на плане. Кнопка «Где я» покажет, где вы стоите.</p>
      </div>
      <div className="mp-floors" role="group" aria-label="Выбор этажа">
        {floors.map((item) => <button key={item.id} type="button" aria-pressed={floor === item.id} className={floor === item.id ? 'is-on' : ''} onClick={() => chooseFloor(item.id)}>
          <b>{item.id}</b><span>этаж</span><small>{rooms.filter((room) => room.floor === item.id).length}</small>
        </button>)}
      </div>
    </header>

    <div className="mp-toolbar">
      <div className="mp-search"><RoomSearchSelect label="Найти на карте" value={selected?.id || ''} onChange={(id) => selectRoom(rooms.find((room) => room.id === id))} placeholder="Номер, название или преподаватель" /></div>
      <div className="mp-actions">
        <button type="button" className={`mp-action mp-locate ${gpsEnabled ? 'is-on' : ''} ${gps.status === 'loading' ? 'is-wait' : ''}`} onClick={locate} aria-pressed={gpsEnabled}><LocateFixed size={17} /><span>Где я</span></button>
        <button type="button" className={`mp-action ${picking === 'manual' ? 'is-on' : ''}`} onClick={() => { setMode3d(false); setPicking(picking === 'manual' ? '' : 'manual'); setPointFeedback('') }} aria-pressed={picking === 'manual'}><MapPin size={17} /><span>{picking === 'manual' ? 'Отменить' : 'Поставить метку'}</span></button>
        <button type="button" className={`mp-action mp-icon ${settingsOpen ? 'is-on' : ''}`} onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen} aria-label="Настройки карты" title="Настройки карты"><Settings2 size={17} /></button>
      </div>
    </div>

    {settingsOpen && <div className="mp-settings" aria-label="Настройки карты">
      <label><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /><span><strong>Подписи помещений</strong><small>Названия и номера кабинетов</small></span></label>
      <label><input type="checkbox" checked={showDoorMarks} onChange={(event) => setShowDoorMarks(event.target.checked)} /><span><strong>Отметки дверей</strong><small>Синие черточки у входов</small></span></label>
      <label><input type="checkbox" checked={contrast} onChange={(event) => toggleContrast(event.target.checked)} /><span><strong>Контрастный план</strong><small>Чёткие стены, жирные подписи и толстая линия маршрута</small></span></label>
      <div className="mp-settings-gps">
        <span><strong>Привязка GPS</strong><small>{gpsAnchors[floor]?.length === 2 ? `На ${floor} этаже — ваши две точки` : `По углам корпуса. Если метка заметно уезжает, отметьте две точки сами.`}</small></span>
        {gps.status === 'active' && <button type="button" onClick={() => { setMode3d(false); setPicking(picking === 'gps' ? '' : 'gps'); setPointFeedback('') }}>{picking === 'gps' ? 'Отменить' : 'Уточнить привязку'}</button>}
        {gpsAnchors[floor]?.length > 0 && <button type="button" onClick={() => setGpsAnchors((current) => ({ ...current, [floor]: [] }))}>Вернуть по корпусу</button>}
      </div>
      <div className="mp-settings-gps">
        <span><strong>Bluetooth-маячки</strong><small>{!beacons.length ? 'В колледже пока не установлены. Когда появятся, место будет определяться и там, где GPS не ловит.' : bleSupport === 'none' ? 'Этот браузер не даёт сайту Bluetooth (так на iPhone и в Safari). Работает в Chrome на Android.' : bleOn ? `Включён, слышно маячков: ${ble.heard}` : `Установлено маячков: ${beacons.length}. Рядом с ними место определяется без GPS и с этажом.`}</small></span>
        {canBluetooth && (bleOn ? <button type="button" onClick={disableBluetooth}>Выключить</button> : <button type="button" onClick={() => void enableBluetooth()}>Включить</button>)}
      </div>
    </div>}

    <div className="mp-chips" role="group" aria-label="Фильтр помещений">
      {categoryLabels.map((category) => {
        const count = category === 'Все места' ? floorRooms.length : floorRooms.filter((room) => room.category === category).length
        return <button key={category} type="button" className={filter === category ? 'is-on' : ''} onClick={() => setFilter(category)} aria-pressed={filter === category} disabled={!count}>{category}<span>{count}</span></button>
      })}
    </div>
    {filter !== 'Все места' && <div className="mp-filter-results" aria-live="polite">{floorRooms.filter((room) => room.category === filter).map((room) => <button type="button" key={room.id} className={selected?.id === room.id ? 'is-on' : ''} onClick={() => selectRoom(room)}>{roomTitle(room)}</button>)}</div>}

    <div className="mp-workspace">
      <div className={`mp-map ${picking ? 'is-picking' : ''}`}>
        <div className="mp-map-top">
          <span className="mp-map-views">
            <span className="mp-segment" role="group" aria-label="Вид карты">
              <button type="button" aria-pressed={!mode3d && !inPanorama} onClick={() => { setPanorama(false); setMode3d(false) }}><Square size={14} /> 2D</button>
              <button type="button" aria-pressed={mode3d && !inPanorama} onClick={() => { setPanorama(false); setPicking(''); setZoomed(false); setMode3d(true) }}><Box size={14} /> 3D</button>
              {theme === 'v2' && <button type="button" aria-pressed={inPanorama} onClick={() => { setPicking(''); setPanorama(true) }}>Панорама β</button>}
            </span>
            {!inPanorama && !mode3d && <button type="button" className="mp-zoom" onClick={() => setZoomed((value) => !value)} aria-label={zoomed ? 'Показать весь план' : 'Увеличить план'} title={zoomed ? 'Весь план' : 'Крупнее'}>{zoomed ? <ZoomOut size={16} /> : <ZoomIn size={16} />}</button>}
          </span>
        </div>
        {inPanorama ? <Suspense fallback={<p>Открываем панораму…</p>}><FloorPanorama floor={floor} onExit={() => { setPanorama(false); setMode3d(false) }} /></Suspense> : mode3d
          ? <div className="map-scene"><RouteScene floor={floor} mode="3d" points={scenePoints} selectedId={selected?.id || ''} targetId={routeTargetId && routeStart ? routeTargetId : ''} onRoomClick={selectRoom} notices={floorNotices} filterCategory={filter} /></div>
          : <FloorMap floor={floor} selectedId={selected?.id || ''} onSelect={selectRoom} onFloorRequest={picking ? undefined : chooseFloor} onPointSelect={placePoint} picking={Boolean(picking)} zoomed={zoomed} filterCategory={filter} showLabels={showLabels} showDoorMarks={showDoorMarks} manualPoint={manualPoint} gpsMarker={gpsMarker} centerOn={centerOn} routeStart={routeStart} routeTargetId={routeTargetId} transition={routeModeParam} notices={floorNotices} />}

        <div className="mp-overlay" aria-live="polite">
          {picking && <div className="mp-pill mp-pill-hint" role="status"><MapPin size={15} /><span>{picking === 'gps' ? 'Коснитесь на плане места, где вы стоите. Нужны две точки на одном этаже.' : 'Коснитесь места на плане: кабинета или коридора.'}</span><button type="button" className="mp-pill-close" onClick={() => setPicking('')} aria-label="Отменить"><X size={15} /></button></div>}
          {gpsInfo && <div className={`mp-pill mp-pill-gps mp-tone-${gpsInfo.tone}`} role="status">
            {gpsInfo.tone === 'bad' ? <LocateOff size={15} /> : <LocateFixed size={15} />}
            <span>{gpsInfo.text}</span>
            <button type="button" className="mp-pill-close" onClick={stopGps} aria-label="Выключить GPS" title="Выключить GPS"><X size={15} /></button>
            {(gpsInfo.ok || (canBluetooth && !bleOn)) && <span className="mp-pill-actions">
              {gpsInfo.ok && <button type="button" onClick={useGpsAsStart}><Navigation size={14} /> Начать маршрут отсюда</button>}
              {gpsInfo.ok && !byBluetooth && <button type="button" onClick={() => chooseFloor(otherFloor(floor))}>Я на {otherFloor(floor)} этаже</button>}
              {canBluetooth && !bleOn && <button type="button" onClick={() => void enableBluetooth()} disabled={ble.status === 'starting'}><Bluetooth size={14} /> {ble.status === 'starting' ? 'Включаем…' : 'Уточнить по Bluetooth'}</button>}
              {gpsMarker && !Number.isFinite(compassHeading) && hasTouch && <button type="button" onClick={requestCompass} title="Показать, куда вы смотрите"><Compass size={14} /> Компас</button>}
            </span>}
            {bleNote && <small className="mp-pill-note">{bleNote}</small>}
          </div>}
          {pointFeedback && !picking && <div className="mp-pill" role="status"><span>{pointFeedback}</span><button type="button" className="mp-pill-close" onClick={() => setPointFeedback('')} aria-label="Скрыть"><X size={15} /></button></div>}
        </div>
      </div>

      <aside className={`mp-detail ${selected ? 'is-room' : ''}`} aria-live="polite">
        {manualPoint && <div className="mp-start">
          <MapPin size={16} />
          <span><strong>Ваша метка</strong><small>{manualPoint.floor} этаж, начало маршрута</small></span>
          {manualPoint.floor !== floor && <button type="button" onClick={() => chooseFloor(manualPoint.floor)}>Показать</button>}
          <button type="button" onClick={() => { setManualPoint(null); setPointFeedback('') }} aria-label="Удалить метку"><X size={16} /></button>
        </div>}
        {selected ? <div className="mp-room">
          <RoomPhoto room={selected} />
          {!photosFor(selected).length && <div className="mp-room-icon"><Building2 size={22} strokeWidth={1.6} /></div>}
          <div className="mp-room-meta"><FloorTag floor={selected.floor} /><span>{selected.category}</span></div>
          <h2>{selected.name}</h2>
          {selected.number && <div className="mp-room-number">Кабинет <strong>{selected.number}</strong></div>}
          {selected.description && <p>{selected.description}</p>}
          <Link className="button button-primary mp-route" to={`/route?${fromParam ? `from=${encodeURIComponent(fromParam)}&` : manualPoint ? 'from=manual&' : ''}to=${encodeURIComponent(selected.id)}${params.get('mode') === 'stairs' ? '&mode=stairs' : ''}`}>Построить маршрут <ArrowRight size={16} /></Link>
          {stair && <button type="button" className="mp-secondary" onClick={() => chooseFloor(otherFloor(floor), rooms.find((room) => room.id === `${stair[1]}-${otherFloor(floor)}`))}>Подняться по лестнице на {otherFloor(floor)} этаж <ArrowRight size={15} /></button>}
          <div className="mp-room-extra"><FavoriteButton id={selected.id} /></div>
          {selectedNotices.map((notice, index) => <div key={index} className={`nv-notice-item nv-notice-${NOTICE_TYPES[notice.type].tone}`}><TriangleAlert size={16} aria-hidden="true" /><span><strong>{notice.title}</strong>{notice.text && <small>{notice.text}</small>}</span></div>)}
          <RoomInfo room={selected} />
          <div className="mp-room-door"><DoorOpen size={15} />{showDoorMarks ? 'Вход — синяя черточка у стены кабинета' : 'Двери можно включить в настройках карты'}</div>
          <MeetButton key={`meet-${selected.id}`} room={selected} />
          <ReportProblem key={selected.id} room={selected} />
          <button type="button" className="mp-clear" onClick={() => chooseFloor(floor, null, true)}>Снять выделение</button>
        </div> : <div className="mp-empty">
          {theme === 'v2' && <div className="mp-floor-index" aria-hidden="true"><span>Этаж</span><b>{String(floor).padStart(2, '0')}</b></div>}
          <h2>Куда идём?</h2>
          <p>Коснитесь кабинета на плане или найдите его в поиске. Здесь появятся номер, вход и кнопка маршрута.</p>
          {popular.length > 0 && <div className="mp-popular"><span>Часто ищут на {floor} этаже</span>{popular.map((room) => <button type="button" key={room.id} onClick={() => selectRoom(room)}><MapPin size={14} />{roomTitle(room)}</button>)}</div>}
          <Link className="mp-directory" to="/rooms">Все кабинеты списком <ArrowUpRight size={14} /></Link>
        </div>}
      </aside>
    </div>

    {floorNotices.length > 0 && <div className="mp-notices" aria-label="Объявления на этаже">{floorNotices.map((notice, index) => { const room = rooms.find((item) => item.id === notice.roomId); return <button type="button" key={index} className={`map-notice map-notice-${notice.type}`} onClick={() => selectRoom(room)}><TriangleAlert size={14} /><span><strong>{notice.title}</strong><small>{roomTitle(room)}</small></span></button> })}</div>}

    <footer className="mp-foot">
      <span className="mp-legend">{showDoorMarks && <span><i className="door-legend" /> Двери</span>}<span><i className="route-legend" /> Маршрут</span><span><i className="mp-legend-you" /> Вы (GPS или Bluetooth)</span><span><i className="mp-legend-pin" /> Ваша метка</span></span>
      <p>Маршрут идёт по коридорам и дверям. Схема примерная: если проход закрыт, следуйте указателям. GPS в здании ошибается на 5–30 м, рядом с Bluetooth-маячком место точнее.</p>
    </footer>
  </section>
}
