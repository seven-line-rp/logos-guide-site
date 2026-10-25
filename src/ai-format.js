// Оформление ответов ИИ: предметы, фильтр иероглифов, графики. Чистые функции
// без React — их проверяют тесты (ai-format.test.js), а рисует components/ai-message.js.

// ---------- Иероглифы ----------
// Модель иногда «проваливается» в китайский: вставляет иероглифы посреди русской
// фразы. Убираем CJK, хирагану/катакану, хангыль и полноширинные знаки (заменяя
// их обычными), кроме случая, когда человек сам писал на этих языках.

const CJK = /[\u2E80-\u2FDF\u3000-\u303F\u3040-\u30FF\u3100-\u312F\u3130-\u318F\u31A0-\u31FF\u3200-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA960-\uA97F\uAC00-\uD7AF\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFFEF]|[\u{20000}-\u{2FA1F}]/u
const CJK_ALL = new RegExp(CJK.source, 'gu')
const FULLWIDTH_PUNCT = { '，': ', ', '、': ', ', '。': '. ', '：': ': ', '；': '; ', '！': '! ', '？': '? ', '（': ' (', '）': ') ', '【': ' [', '】': '] ', '《': ' «', '》': '» ', '“': ' «', '”': '» ' }

export function hasCjk(text) {
  return CJK.test(String(text || ''))
}

export function stripCjk(text) {
  const source = String(text || '')
  if (!CJK.test(source)) return source
  return source
    .replace(/[，、。：；！？（）【】《》“”]/g, (char) => FULLWIDTH_PUNCT[char] || '')
    .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0))
    .replace(CJK_ALL, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.:;!?)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/[ \t]+$/gm, '')
}

// Чистим ответ, если человек не писал иероглифами сам.
export function cleanReply(reply, question = '') {
  return hasCjk(question) ? String(reply || '') : stripCjk(reply)
}

// ---------- Предметы ----------
// Ответ начинается с метки [[предмет: math]]: по ней страница красит карточку
// и ставит значок. Метки в тексте для читателя нет.

export const SUBJECTS = {
  math: 'Математика',
  physics: 'Физика',
  chemistry: 'Химия',
  informatics: 'Информатика',
  russian: 'Русский язык',
  literature: 'Литература',
  history: 'История',
  biology: 'Биология',
  geography: 'География',
  english: 'Английский',
  economics: 'Экономика',
  drawing: 'Черчение',
}

const subjectMark = /^\s*\[\[\s*(?:предмет|subject)\s*:\s*([^\]\s]+)\s*\]\]\s*/i

export function splitSubject(text) {
  const source = String(text || '')
  const match = source.match(subjectMark)
  if (!match) return { subject: '', text: source }
  const key = match[1].toLowerCase()
  return { subject: Object.hasOwn(SUBJECTS, key) ? key : '', text: source.slice(match[0].length) }
}

// ---------- Подписи блоков ----------
// Цитата, начинающаяся с «**Дано:**», «**Ответ:**» и т. п., рисуется как плашка.

const callouts = [
  [/^(кратко|суть|главное|tl;?dr|резюме|в двух словах)/i, 'summary'],
  [/^(дано|условие)/i, 'given'],
  [/^(решение|ход решения|разбор|шаги?|алгоритм)/i, 'solution'],
  [/^(ответ|итог|результат|вывод)/i, 'answer'],
  [/^(определение|понятие|термин)/i, 'definition'],
  [/^(формул|закон|правило|теорема)/i, 'rule'],
  [/^(важно|внимание|помни|осторожно|ошибк|типичн)/i, 'warn'],
  [/^(пример)/i, 'example'],
  [/^(совет|лайфхак|подсказка)/i, 'tip'],
  [/^(проверка)/i, 'check'],
]

export function calloutKind(label) {
  const clean = String(label || '').replace(/[*_:\s]+$/g, '').trim()
  for (const [pattern, kind] of callouts) if (pattern.test(clean)) return kind
  return 'note'
}

// ---------- Графики ----------
// Блок ```chart с JSON. Виды: function (формула y = …), line / scatter (точки),
// bar (столбцы), pie (доли). Формулу считает безопасный разбор ниже — eval нет.

export const CHART_KINDS = ['function', 'line', 'scatter', 'bar', 'pie']
const MAX_POINTS = 400
const MAX_SERIES = 6

const FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, cbrt: Math.cbrt, abs: Math.abs, exp: Math.exp, ln: Math.log, log: Math.log10, log2: Math.log2,
  floor: Math.floor, ceil: Math.ceil, sign: Math.sign, sh: Math.sinh, ch: Math.cosh, tg: Math.tan, ctg: (x) => 1 / Math.tan(x),
}
const CONSTANTS = { pi: Math.PI, π: Math.PI, e: Math.E }

function tokenize(source) {
  const text = String(source).toLowerCase().replace(/\s+/g, '').replace(/[×·]/g, '*').replace(/[−–]/g, '-').replace(/÷/g, '/').replace(/\*\*/g, '^')
  const tokens = []
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    const number = rest.match(/^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/)
    if (number) { tokens.push({ t: 'num', v: Number(number[0]) }); i += number[0].length; continue }
    const word = rest.match(/^[a-zπ][a-z0-9]*/)
    if (word) { tokens.push({ t: 'id', v: word[0] }); i += word[0].length; continue }
    if ('+-*/^(),|'.includes(text[i])) { tokens.push({ t: 'op', v: text[i] }); i += 1; continue }
    throw new Error('символ')
  }
  return tokens
}

// Разбор: выражение → функция (x) => число. Неявное умножение: 2x, 3(x+1), x(x-1).
export function compileExpression(source) {
  const tokens = tokenize(String(source).replace(/^\s*(?:y|f\(x\))\s*=\s*/i, ''))
  let pos = 0
  const peek = () => tokens[pos]
  const take = () => tokens[pos++]
  const isOp = (value) => peek()?.t === 'op' && peek().v === value

  function expression() {
    let left = term()
    while (isOp('+') || isOp('-')) {
      const op = take().v
      const right = term()
      const a = left
      left = op === '+' ? (x) => a(x) + right(x) : (x) => a(x) - right(x)
    }
    return left
  }
  function term() {
    let left = unary()
    for (;;) {
      const next = peek()
      const implicit = next && (next.t === 'num' || next.t === 'id' || (next.t === 'op' && next.v === '('))
      if (isOp('*') || isOp('/')) {
        const op = take().v
        const right = unary()
        const a = left
        left = op === '*' ? (x) => a(x) * right(x) : (x) => a(x) / right(x)
      } else if (implicit) {
        const right = power()
        const a = left
        left = (x) => a(x) * right(x)
      } else return left
    }
  }
  function unary() {
    if (isOp('-')) { take(); const inner = unary(); return (x) => -inner(x) }
    if (isOp('+')) { take(); return unary() }
    return power()
  }
  function power() {
    const base = atom()
    if (isOp('^')) {
      take()
      const exponent = unary()
      return (x) => Math.pow(base(x), exponent(x))
    }
    return base
  }
  function atom() {
    const token = take()
    if (!token) throw new Error('конец')
    if (token.t === 'num') return () => token.v
    if (token.t === 'op' && token.v === '(') {
      const inner = expression()
      if (!isOp(')')) throw new Error('скобка')
      take()
      return inner
    }
    if (token.t === 'op' && token.v === '|') {
      const inner = expression()
      if (!isOp('|')) throw new Error('модуль')
      take()
      return (x) => Math.abs(inner(x))
    }
    if (token.t === 'id') {
      if (token.v === 'x') return (x) => x
      if (Object.hasOwn(CONSTANTS, token.v)) return () => CONSTANTS[token.v]
      const fn = Object.hasOwn(FUNCTIONS, token.v) ? FUNCTIONS[token.v] : null
      if (fn && isOp('(')) {
        take()
        const arg = expression()
        if (!isOp(')')) throw new Error('скобка')
        take()
        return (x) => fn(arg(x))
      }
    }
    throw new Error('токен')
  }

  const result = expression()
  if (pos < tokens.length) throw new Error('лишнее')
  return result
}

function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function cleanText(value, max = 80) {
  return stripCjk(String(value ?? '')).replace(/[<>]/g, '').slice(0, max)
}

// JSON из блока → безопасное описание графика или null.
export function parseChartSpec(input) {
  let data
  try { data = typeof input === 'string' ? JSON.parse(input) : input } catch { return null }
  if (!data || typeof data !== 'object') return null
  const kind = CHART_KINDS.includes(data.type) ? data.type : (data.fn || data.f || data.functions ? 'function' : 'line')
  const base = { kind, title: cleanText(data.title, 100), xLabel: cleanText(data.xLabel ?? data.x, 40), yLabel: cleanText(data.yLabel ?? data.y, 40) }

  if (kind === 'function') {
    const list = [].concat(data.functions || data.fn || data.f || []).slice(0, MAX_SERIES)
    let from = finite(data.from ?? data.xMin ?? data.min)
    let to = finite(data.to ?? data.xMax ?? data.max)
    if (from === null) from = -10
    if (to === null) to = 10
    if (!(to > from)) return null
    const series = []
    for (const item of list) {
      const text = typeof item === 'string' ? item : item?.expr || item?.fn || item?.f
      if (!text || String(text).length > 120) continue
      let fn
      try { fn = compileExpression(text) } catch { continue }
      const points = []
      for (let i = 0; i <= 240; i += 1) {
        const x = from + ((to - from) * i) / 240
        const y = fn(x)
        points.push([x, Number.isFinite(y) && Math.abs(y) < 1e9 ? y : null])
      }
      series.push({ name: cleanText(typeof item === 'object' && item.name ? item.name : `y = ${String(text).replace(/^\s*y\s*=\s*/i, '')}`, 60), points })
    }
    if (!series.length) return null
    return { ...base, series, marks: parseMarks(data.points) }
  }

  if (kind === 'pie') {
    const items = (Array.isArray(data.data) ? data.data : Array.isArray(data.values) ? data.values : []).slice(0, 12)
      .map((item, index) => Array.isArray(item) ? { label: cleanText(item[0], 40), value: finite(item[1]) } : { label: cleanText(item?.label ?? item?.name ?? `#${index + 1}`, 40), value: finite(item?.value ?? item?.y) })
      .filter((item) => item.value !== null && item.value > 0)
    return items.length ? { ...base, items } : null
  }

  if (kind === 'bar') {
    const labels = Array.isArray(data.labels) ? data.labels.slice(0, 24).map((label) => cleanText(label, 24)) : []
    const raw = Array.isArray(data.series) ? data.series : [{ name: '', values: data.values ?? data.data }]
    const series = raw.slice(0, MAX_SERIES).map((entry) => {
      const values = (Array.isArray(entry) ? entry : entry?.values ?? entry?.data ?? []).slice(0, labels.length || 24).map(finite)
      return { name: cleanText(entry?.name, 40), values }
    }).filter((entry) => entry.values.some((value) => value !== null))
    if (!series.length) return null
    const count = Math.max(labels.length, ...series.map((entry) => entry.values.length))
    return { ...base, labels: Array.from({ length: count }, (_, i) => labels[i] ?? String(i + 1)), series }
  }

  // line / scatter: series: [{name, points: [[x, y], …]}] или points: [[x, y], …]
  const raw = Array.isArray(data.series) ? data.series : [{ name: data.name, points: data.points ?? data.data }]
  const series = raw.slice(0, MAX_SERIES).map((entry) => {
    const list = Array.isArray(entry) ? entry : entry?.points ?? entry?.data ?? []
    const points = list.slice(0, MAX_POINTS).map((point) => Array.isArray(point) ? [finite(point[0]), finite(point[1])] : [finite(point?.x), finite(point?.y)]).filter((point) => point[0] !== null && point[1] !== null)
    return { name: cleanText(entry?.name, 40), points }
  }).filter((entry) => entry.points.length > 0)
  return series.length ? { ...base, series } : null
}

function parseMarks(list) {
  return (Array.isArray(list) ? list : []).slice(0, 12).map((point) => Array.isArray(point) ? { x: finite(point[0]), y: finite(point[1]), label: cleanText(point[2], 24) } : { x: finite(point?.x), y: finite(point?.y), label: cleanText(point?.label, 24) }).filter((mark) => mark.x !== null && mark.y !== null)
}

// «Красивые» отметки на осях: шаг 1 / 2 / 5 × 10ⁿ.
export function niceTicks(min, max, target = 6) {
  if (!(max > min)) return [min]
  const raw = (max - min) / target
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((k) => k * magnitude).find((value) => value >= raw) || raw
  const ticks = []
  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) ticks.push(Number(value.toPrecision(12)))
  return ticks
}

export function formatTick(value) {
  if (Math.abs(value) >= 1e6 || (value !== 0 && Math.abs(value) < 1e-3)) return value.toExponential(0).replace('e+', '·10^').replace('e-', '·10^-')
  return String(Number(value.toFixed(6))).replace('.', ',')
}

// Границы значений графика (y режется, чтобы асимптоты не растягивали ось).
export function chartBounds(spec) {
  if (spec.kind === 'bar') {
    const values = spec.series.flatMap((entry) => entry.values.filter((v) => v !== null))
    const max = Math.max(0, ...values)
    const min = Math.min(0, ...values)
    return { x0: 0, x1: spec.labels.length, y0: min, y1: max > min ? max : min + 1 }
  }
  const points = spec.series.flatMap((entry) => entry.points.filter((p) => p[1] !== null))
  if (!points.length) return { x0: 0, x1: 1, y0: 0, y1: 1 }
  const xs = points.map((p) => p[0])
  let ys = points.map((p) => p[1]).sort((a, b) => a - b)
  if (spec.kind === 'function' && ys.length > 20) {
    const low = ys[Math.floor(ys.length * 0.02)]
    const high = ys[Math.ceil(ys.length * 0.98) - 1]
    const pad = (high - low) * 0.6 || 1
    ys = ys.filter((y) => y >= low - pad && y <= high + pad)
  }
  let [y0, y1] = [ys[0], ys[ys.length - 1]]
  if (!(y1 > y0)) { y0 -= 1; y1 += 1 }
  let [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  if (!(x1 > x0)) { x0 -= 1; x1 += 1 }
  const pad = (y1 - y0) * 0.06
  return { x0, x1, y0: y0 - pad, y1: y1 + pad }
}
