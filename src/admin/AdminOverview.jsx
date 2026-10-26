import { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, ChartColumn, ChartSpline, QrCode, RefreshCw, TriangleAlert } from 'lucide-react'
import { rooms } from '../data.js'
import { signRooms, roomName } from '../signs.js'
import { fetchStats } from './admin-api.js'
import Chart from './Charts.jsx'
import { METRICS, PAGE_NAMES, PERIODS, buildSeries, formatNumber, pageRanking, periodTotals, qrRanking } from './stats-model.js'

// Обзор: посетители, просмотры и сканы QR за день, неделю, месяц и всё
// время. Данные собирает public/api/stats.php (deploy/stats.md).

const VS = { day: 'со вчера', week: 'с прошлой неделей', month: 'с прошлым месяцем' }
const PERIOD_TEXT = { day: 'сегодня', week: 'за 7 дней', month: 'за 30 дней', all: 'за всё время' }
const UNITS = { u: 'посетителей', v: 'просмотров', qr: 'сканов' }

function Delta({ delta, period }) {
  if (delta === null || delta === undefined) return <span className="adm-delta adm-delta-flat">{period === 'all' ? 'с начала подсчёта' : 'нет данных для сравнения'}</span>
  const Icon = delta >= 0 ? ArrowUpRight : ArrowDownRight
  return <span className={`adm-delta ${delta > 0 ? 'adm-delta-up' : delta < 0 ? 'adm-delta-down' : 'adm-delta-flat'}`}><Icon size={13} aria-hidden="true" />{delta > 0 ? '+' : ''}{delta}% {VS[period]}</span>
}

function Ranking({ title, caption, rows, empty, children }) {
  const top = rows[0]?.count || 1
  return <section className="adm-card">
    <div className="adm-card-head"><h2>{title}</h2><span className="adm-muted">{caption}</span></div>
    {rows.length === 0 ? <p className="adm-empty">{empty}</p> : <ol className="adm-rank">
      {rows.map((row) => <li key={row.id}>
        <span className="adm-rank-name">{row.name}{row.note && <small>{row.note}</small>}</span>
        <span className="adm-rank-value">{formatNumber(row.count)}</span>
        <span className="adm-rank-bar" aria-hidden="true"><i style={{ width: `${Math.max((row.count / top) * 100, 2)}%` }} /></span>
      </li>)}
    </ol>}
    {children}
  </section>
}

export default function AdminOverview() {
  const { adminKey, logout } = useOutletContext()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('week')
  const [metric, setMetric] = useState('u')
  const [kind, setKind] = useState('bar')
  const [showAllQr, setShowAllQr] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await fetchStats(adminKey)) } catch (failure) {
      setError(failure.message)
      if (/ключ/i.test(failure.message)) logout()
    } finally { setLoading(false) }
  }, [adminKey, logout])
  useEffect(() => { load() }, [load])

  const days = data?.days
  const today = data?.today
  const model = useMemo(() => {
    if (!days) return null
    const { keys, totals } = periodTotals(days, today, period)
    const chartMetric = period === 'day' ? 'v' : metric
    const scans = new Map(qrRanking(days, keys).map((row) => [row.room, row.count]))
    const known = signRooms.map((room) => ({ id: room.id, name: roomName(room), note: `${room.floor} этаж`, count: scans.get(room.id) || 0 }))
    const unknown = [...scans].filter(([id]) => !signRooms.some((room) => room.id === id)).map(([id, count]) => ({ id, name: rooms.find((room) => room.id === id)?.name || id, note: '', count }))
    const qr = [...known, ...unknown].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ru'))
    const pages = pageRanking(days, keys).map((row) => ({ id: row.path, name: PAGE_NAMES[row.path] || row.path, note: '', count: row.count }))
    return { totals, chartMetric, series: buildSeries(days, today, period, chartMetric), qr, pages, scanned: qr.filter((row) => row.count > 0), silent: qr.filter((row) => row.count === 0) }
  }, [days, today, period, metric])

  const empty = model && model.totals.v.value === 0 && model.totals.qr.value === 0
  const metricInfo = METRICS.find((item) => item.id === model?.chartMetric)
  const chartTitle = period === 'day' ? 'Просмотры по часам' : metricInfo?.label

  return <>
    <div className="adm-head">
      <div><h1>Обзор</h1><p>Сколько человек пользуется путеводителем и как часто сканируют таблички.</p></div>
      <div className="adm-head-tools">
        <div className="adm-seg" role="group" aria-label="Период">{PERIODS.map((item) => <button key={item.id} type="button" className={period === item.id ? 'adm-seg-active' : ''} aria-pressed={period === item.id} onClick={() => setPeriod(item.id)}>{item.label}</button>)}</div>
        <button type="button" className="adm-icon" onClick={load} disabled={loading} aria-label="Обновить данные" title="Обновить"><RefreshCw size={15} className={loading ? 'adm-spin' : ''} /></button>
      </div>
    </div>

    {error && <p className="adm-alert adm-alert-bad" role="alert"><TriangleAlert size={16} /> {error}</p>}
    {!model && !error && <div className="adm-skeleton" aria-busy="true" aria-label="Загружаем статистику"><i /><i /><i /></div>}

    {model && <>
      <div className="adm-kpis">
        {METRICS.map((item) => {
          const total = model.totals[item.id]
          const selected = model.chartMetric === item.id
          return <button key={item.id} type="button" className={`adm-kpi ${selected ? 'adm-kpi-active' : ''}`} aria-pressed={selected} disabled={period === 'day' && item.id !== 'v'} onClick={() => setMetric(item.id)}>
            <span className="adm-kpi-label">{item.id === 'qr' && <QrCode size={14} aria-hidden="true" />}{item.label}</span>
            <strong>{formatNumber(total.value)}</strong>
            <Delta delta={total.delta} period={period} />
            <small>{item.hint}, {PERIOD_TEXT[period]}</small>
          </button>
        })}
      </div>

      <section className="adm-card adm-chart-card">
        <div className="adm-card-head">
          <div><h2>{chartTitle}</h2><span className="adm-muted">{PERIOD_TEXT[period]}{period === 'day' ? '' : ', по ' + (model.series.length > 31 ? 'месяцам' : 'дням')}</span></div>
          <div className="adm-seg adm-seg-icons" role="group" aria-label="Вид диаграммы">
            <button type="button" className={kind === 'bar' ? 'adm-seg-active' : ''} aria-pressed={kind === 'bar'} onClick={() => setKind('bar')} aria-label="Столбцы" title="Столбцы"><ChartColumn size={16} /></button>
            <button type="button" className={kind === 'line' ? 'adm-seg-active' : ''} aria-pressed={kind === 'line'} onClick={() => setKind('line')} aria-label="График" title="График"><ChartSpline size={16} /></button>
          </div>
        </div>
        <Chart series={model.series} kind={kind} unit={UNITS[model.chartMetric]} label={`${chartTitle}, ${PERIOD_TEXT[period]}`} />
        {empty && <p className="adm-chart-note">Пока тихо: данные появятся с первых посещений{data.since ? ` (подсчёт идёт с ${data.since.split('-').reverse().join('.')})` : ''}.</p>}
        {period === 'day' && <p className="adm-chart-note">По часам считаются просмотры страниц; посетители и сканы за день — в карточках выше.</p>}
      </section>

      <div className="adm-split adm-split-even">
        <Ranking title="QR-таблички" caption={`${model.scanned.length} из ${model.qr.length} сканировали`} rows={showAllQr ? model.qr : model.scanned.slice(0, 8)} empty="Сканов пока нет. Когда посетитель отсканирует табличку, она появится здесь.">
          {(model.scanned.length > 8 || model.silent.length > 0) && <button type="button" className="adm-link" onClick={() => setShowAllQr((value) => !value)}>{showAllQr ? 'Свернуть' : `Показать все (${model.qr.length}), в том числе без сканов`}</button>}
        </Ranking>
        <Ranking title="Страницы" caption="по просмотрам" rows={model.pages.slice(0, 10)} empty="Просмотров пока нет." />
      </div>
      <p className="adm-fine">Посетитель — уникальный за сутки браузер; за неделю или месяц это сумма по дням, поэтому тот, кто заходил в разные дни, учтён несколько раз. Личных данных, cookie и IP в статистике нет.</p>
    </>}
  </>
}
