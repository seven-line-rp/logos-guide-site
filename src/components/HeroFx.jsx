// Линии маршрутов поверх сцены первого экрана: семь путей, у каждого своя
// циклическая анимация. Только CSS на stroke-dashoffset, transform и opacity;
// тайминги и цвета — в hero-fx.css.
const paths = {
  draw: 'M560 540 H700 L760 480 V330 L820 270 H980',
  march: 'M540 90 H660 L720 150 H860 L920 210 V330',
  snake: 'M980 420 H820 L760 480 V560',
  pingpong: 'M600 330 H700 L740 290 H860',
  laneA: 'M520 230 H640 L690 280 H780',
  laneB: 'M520 246 H632 L682 296 H780',
  pin: 'M880 560 V470 L840 430 H780',
}
const stations = [[700, 540], [760, 330], [820, 270], [540, 90], [720, 150], [920, 210]]

export default function HeroFx() {
  return <svg className="hero-fx" viewBox="0 0 1000 600" preserveAspectRatio="xMaxYMid slice" aria-hidden="true">
    <path className="fx-base" d={paths.draw} />
    <path className="fx-draw" d={paths.draw} pathLength="1" />

    <path className="fx-base" d={paths.march} />
    <path className="fx-march" d={paths.march} />

    <path className="fx-base" d={paths.snake} />
    <path className="fx-snake" d={paths.snake} pathLength="1" />

    <path className="fx-base" d={paths.pingpong} />
    <path className="fx-pingpong" d={paths.pingpong} pathLength="1" />

    <path className="fx-lane fx-lane-a" d={paths.laneA} />
    <path className="fx-lane fx-lane-b" d={paths.laneB} />

    <path className="fx-base" d={paths.pin} />
    <path className="fx-pin-line" d={paths.pin} pathLength="1" />
    <g className="fx-pin" transform="translate(780 430)"><circle className="fx-pin-ripple" r="10" /><circle className="fx-pin-dot" r="5" /></g>

    {stations.map(([x, y], index) => <g key={index} transform={`translate(${x} ${y})`}><circle className="fx-station" r="5" style={{ animationDelay: `${index * 1.1}s` }} /><circle className="fx-station-core" r="2.6" /></g>)}
  </svg>
}
