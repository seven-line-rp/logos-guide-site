// Силуэт Московского Кремля по низу главного экрана в теме «Единство»:
// стена с зубцами «ласточкин хвост», башни с шатрами и Спасская башня с
// золотыми часами. Путь собирается один раз из простых фигур.

const GROUND = 150
const WALL = 114

function merlons(from, to, base = WALL, step = 20) {
  let path = ''
  for (let x = from; x + 12 <= to; x += step) path += `M${x} ${base}V${base - 12}L${x + 6} ${base - 7}L${x + 12} ${base - 12}V${base}Z`
  return path
}

function tower({ x, w, top, roof }) {
  return `M${x} ${GROUND}V${top}H${x + w}V${GROUND}Z` + `M${x - 3} ${top}L${x + w / 2} ${roof}L${x + w + 3} ${top}Z` + `M${x + w / 2 - 1} ${roof}h2v-8h-2Z`
}

const TOWERS = [
  { x: 70, w: 34, top: 84, roof: 50 },
  { x: 300, w: 30, top: 90, roof: 62 },
  { x: 820, w: 38, top: 78, roof: 40 },
  { x: 1070, w: 32, top: 88, roof: 58 },
  { x: 1320, w: 40, top: 76, roof: 34 },
]
const SPASSKAYA = { x: 540, w: 56 }

function kremlinPath() {
  const { x, w } = SPASSKAYA
  let path = `M0 ${GROUND}V${WALL}H1440V${GROUND}Z` + merlons(0, 1440)
  for (const item of TOWERS) path += tower(item)
  path += `M${x} ${GROUND}V60H${x + w}V${GROUND}Z` + merlons(x, x + w, 60, 22)
  path += `M${x + 8} 60V38H${x + w - 8}V60Z` + `M${x + 15} 38V24H${x + w - 15}V38Z` + `M${x + 13} 24L${x + w / 2} 0L${x + w - 13} 24Z`
  return path
}

const PATH = kremlinPath()

export default function UnityKremlin() {
  const { x, w } = SPASSKAYA
  return <svg className="unity-kremlin" viewBox="0 0 1440 150" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <path d={PATH} />
    <circle className="unity-kremlin-clock" cx={x + w / 2} cy="80" r="10" />
    <circle className="unity-kremlin-gold" cx={x + w / 2} cy="-2" r="3" />
    {TOWERS.map((item) => <circle key={item.x} className="unity-kremlin-gold" cx={item.x + item.w / 2} cy={item.roof - 10} r="2.2" />)}
  </svg>
}
