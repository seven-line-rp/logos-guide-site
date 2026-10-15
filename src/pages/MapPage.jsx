import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, Building2, DoorOpen, Layers2, LocateFixed, MapPin, Search, Settings2, Sparkles } from 'lucide-react'
import { floors, rooms, categoryLabels } from '../data'
import FloorMap from '../components/FloorMap'
import { FloorTag, PageHeading, Reveal } from '../components/Primitives'

export default function MapPage() {
  const [params, setParams] = useSearchParams()
  const floorParam = Number(params.get('floor')) === 2 ? 2 : 1
  const [floor, setFloor] = useState(floorParam)
  const [selectedId, setSelectedId] = useState(params.get('room') || params.get('to') || '')
  const [filter, setFilter] = useState('Все места')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showLabels, setShowLabels] = useState(() => localStorage.getItem('map-show-labels') !== 'false')
  const [showDoorMarks, setShowDoorMarks] = useState(() => localStorage.getItem('map-show-doors') !== 'false')
  const [gpsEnabled, setGpsEnabled] = useState(false)
  const [gpsStatus, setGpsStatus] = useState('idle')
  const [gpsAccuracy, setGpsAccuracy] = useState(0)
  const [gpsCoordinates, setGpsCoordinates] = useState(null)
  const [manualLocationId, setManualLocationId] = useState(() => localStorage.getItem('map-manual-location') || '')
  const [manualLocationMode, setManualLocationMode] = useState(() => params.get('manual') === '1')
  const routeStartId = params.get('from') || ''
  const routeTargetId = params.get('to') || selectedId
  const selected = rooms.find((room) => room.id === selectedId && room.floor === floor)
  const floorRooms = useMemo(() => rooms.filter((room) => room.floor === floor), [floor])

  useEffect(() => {
    setFloor(floorParam)
    setSelectedId(params.get('room') || params.get('to') || '')
  }, [floorParam, params])

  useEffect(() => {
    localStorage.setItem('map-show-labels', String(showLabels))
    localStorage.setItem('map-show-doors', String(showDoorMarks))
  }, [showLabels, showDoorMarks])

  useEffect(() => {
    if (!gpsEnabled) return undefined
    if (!navigator.geolocation) {
      setGpsStatus('unsupported')
      return undefined
    }

    setGpsStatus('loading')
    const watchId = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setGpsAccuracy(Math.round(coords.accuracy))
        setGpsCoordinates({ latitude: coords.latitude, longitude: coords.longitude })
        setGpsStatus('active')
      },
      (error) => {
        setGpsStatus(error.code === 1 ? 'denied' : 'unavailable')
        setGpsEnabled(false)
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    )
    return () => navigator.geolocation.clearWatch(watchId)
  }, [gpsEnabled])

  const chooseFloor = (nextFloor, room = null) => {
    setFloor(nextFloor)
    setSelectedId(room?.id || '')
    const next = new URLSearchParams({ floor: String(nextFloor) })
    if (room) next.set('room', room.id)
    setParams(next, { replace: true })
  }
  const selectRoom = (room) => {
    if (manualLocationMode) {
      setManualLocationId(room.id)
      localStorage.setItem('map-manual-location', room.id)
      setManualLocationMode(false)
    }
    setFloor(room.floor)
    setSelectedId(room.id)
    const nextParams = { floor: String(room.floor), room: room.id }
    if (routeStartId) nextParams.from = routeStartId
    setParams(nextParams, { replace: true })
  }

  return <>
    <PageHeading eyebrow="КАРТА КОЛЛЕДЖА / ИНТЕРАКТИВНЫЙ ПЛАН" title={<>Каждый кабинет —<br /><em>в паре кликов.</em></>} description="Выберите этаж и нажмите на помещение. Поиск, номера кабинетов и быстрые ориентиры — теперь на одной карте." aside={<div className="map-heading-stats"><span className="map-heading-icon"><Layers2 size={19} /></span><strong>02</strong><small>ЭТАЖА<br />В ОДНОЙ СХЕМЕ</small></div>} />

    <section className="map-page-section container">
      <Reveal className="map-control-row"><div className="floor-tabs" role="tablist" aria-label="Выбор этажа">{floors.map((item) => <button key={item.id} role="tab" aria-selected={floor === item.id} className={`floor-tab ${floor === item.id ? 'floor-tab-active' : ''}`} onClick={() => chooseFloor(item.id)}><span className="floor-tab-index">{item.short}</span><span><strong>{item.label}</strong><small>{item.hint}</small></span><i>{floor === item.id && <ArrowUpRight size={16} />}</i></button>)}</div><Link className="map-directory-link" to="/rooms"><Search size={16} /> Не знаете номер? <strong>Открыть справочник</strong><ArrowRight size={14} /></Link></Reveal>

      <div className={`map-tools ${manualLocationMode ? 'map-tools-picking' : ''}`}><div className="map-tools-top"><div className="map-tool-label"><span><i className="map-live-dot" />ПЛАН ЭТАЖА {floor}</span><span>{floorRooms.length} ПОМЕЩЕНИЙ</span></div><div className="map-navigation-actions"><button className={`map-gps-button ${gpsStatus === 'active' ? 'map-gps-active' : ''}`} onClick={() => { if (gpsEnabled) { setGpsEnabled(false); setGpsStatus('idle') } else setGpsEnabled(true) }} aria-pressed={gpsEnabled}><LocateFixed size={16} />{gpsEnabled ? 'Отключить GPS' : 'Моё местоположение'}</button><button className={`map-manual-button ${manualLocationMode ? 'map-manual-active' : ''}`} onClick={() => setManualLocationMode((value) => !value)} aria-pressed={manualLocationMode}><MapPin size={15} />{manualLocationMode ? 'Выберите комнату' : 'Указать вручную'}</button><button className="map-settings-button" onClick={() => setSettingsOpen((value) => !value)} aria-expanded={settingsOpen} aria-label="Настройки карты"><Settings2 size={17} /></button></div></div>{gpsStatus !== 'idle' && <div className={`map-gps-status map-gps-${gpsStatus}`} role="status">{gpsStatus === 'active' ? `GPS подключён · ${gpsCoordinates?.latitude.toFixed(5)}, ${gpsCoordinates?.longitude.toFixed(5)} · точность около ${gpsAccuracy} м. ${gpsAccuracy > 50 ? 'Точность низкая, укажите комнату вручную.' : 'Внутри здания позиция может быть неточной.'}` : gpsStatus === 'loading' ? 'Определяем местоположение… Разрешите доступ к геолокации в браузере.' : gpsStatus === 'denied' ? 'Доступ к геолокации запрещён в настройках браузера.' : gpsStatus === 'unsupported' ? 'Этот браузер не поддерживает геолокацию.' : 'Не удалось определить местоположение. Укажите комнату вручную.'}</div>}{manualLocationMode && <div className="map-manual-hint" role="status">Коснитесь комнаты на плане, чтобы отметить, где вы находитесь.</div>}{manualLocationId && !manualLocationMode && <div className="map-manual-hint" role="status">Ручная точка: {rooms.find((room) => room.id === manualLocationId)?.name}. Выберите место назначения на карте, затем постройте путь.</div>}{settingsOpen && <div className="map-settings-panel" aria-label="Настройки карты"><label><input type="checkbox" checked={showLabels} onChange={(event) => setShowLabels(event.target.checked)} /><span><strong>Подписи помещений</strong><small>Названия и номера кабинетов</small></span></label><label><input type="checkbox" checked={showDoorMarks} onChange={(event) => setShowDoorMarks(event.target.checked)} /><span><strong>Отметки дверей</strong><small>Показывать входы в помещения</small></span></label></div>}<div className="map-category-filters" role="group" aria-label="Фильтр помещений">{categoryLabels.map((category) => <button key={category} className={filter === category ? 'map-filter map-filter-active' : 'map-filter'} onClick={() => setFilter(category)} aria-pressed={filter === category}>{category}</button>)}</div></div>

      <div className="map-workspace"><Reveal className="map-plan-panel"><div className="map-panel-heading"><span><strong>{floor === 1 ? 'Первый этаж' : 'Второй этаж'}</strong><small>{floor === 1 ? 'Столовая · актовый зал · учебные кабинеты' : 'Библиотека · лаборатории · кабинет физики'}</small></span><span className="map-panel-orient"><span>N</span><i /></span></div><FloorMap floor={floor} selectedId={selected?.id || ''} onSelect={selectRoom} onFloorRequest={chooseFloor} filterCategory={filter} showLabels={showLabels} showDoorMarks={showDoorMarks} manualLocationId={manualLocationId} routeStartId={routeStartId} routeTargetId={routeTargetId} /><div className="map-panel-foot">{showDoorMarks && <span><i className="door-legend" /> ДВЕРНОЙ ПРОЁМ</span>}<span>ПЛАН КОРПУСА</span><span>НАЖМИТЕ НА ПОМЕЩЕНИЕ</span><span className="map-pan-hint">СВАЙПАЙТЕ ВЛЕВО / ВПРАВО</span></div></Reveal>
        <Reveal className={`room-detail-panel ${selected ? 'room-detail-selected' : ''}`} delay={100} aria-live="polite">{selected ? <><div className="room-detail-top"><span className="eyebrow"><i className="eyebrow-dot" />{selected.category}</span><span className="room-detail-number">{selected.floor.toString().padStart(2, '0')}</span></div><div className="room-detail-icon"><Building2 size={21} strokeWidth={1.5} /></div><FloorTag floor={selected.floor} /><h2>{selected.name}</h2>{selected.number && <div className="room-number-line">КАБИНЕТ <strong>{selected.number}</strong></div>}<p>{selected.description}</p><div className="room-detail-rule" /><div className="room-detail-info"><span><DoorOpen size={15} />{showDoorMarks ? 'Найдите дверь по синей отметке' : 'Метки дверей скрыты в настройках'}</span><span><MapPin size={15} /> Схема этажа {selected.floor}</span></div><Link className="button button-primary room-route-button" to={`/route?${manualLocationId && manualLocationId !== selected.id ? `from=${manualLocationId}&` : ''}to=${selected.id}`}>Построить маршрут <ArrowRight size={15} /></Link><button className="room-clear" onClick={() => chooseFloor(floor)}>Снять выделение</button></> : <><div className="room-empty-illustration"><MapPin size={24} /><i /><i /><i /></div><span className="eyebrow"><i className="eyebrow-dot" />ВЫБЕРИТЕ ПОМЕЩЕНИЕ</span><h2>Куда<br />направляемся?</h2><p>Нажмите на любую комнату. Мы покажем номер, назначение и поможем построить маршрут.</p><div className="room-detail-rule" /><div className="room-quick-stat"><strong>{floorRooms.length}</strong><span>мест на этом этаже</span></div><Link className="room-browse-link" to="/rooms">Или откройте справочник <ArrowUpRight size={14} /></Link></>}</Reveal>
      </div>

      <div className="map-under-note"><span><Sparkles size={15} /> СОВЕТ</span><p>{showDoorMarks ? 'Синие короткие линии на схеме показывают двери. Сначала найдите свой этаж, затем нажмите на нужное помещение.' : 'Нажмите на помещение, чтобы посмотреть его описание и построить маршрут. Отображение дверей можно включить в настройках карты.'}</p><Link to="/route">Построить маршрут <ArrowRight size={14} /></Link></div>
    </section>
  </>
}
