// Кинематографичный слой первого экрана: семь независимых циклических
// анимаций. Только CSS, только transform и opacity, без обработчиков;
// стили и тайминги — в hero-fx.css.
const bokeh = Array.from({ length: 9 }, (_, index) => ({
  left: (index * 29 + 8) % 96,
  top: (index * 41 + 12) % 88,
  size: 70 + ((index * 37) % 90),
  delay: -(index * 2.3),
  duration: 16 + (index % 4) * 4,
}))

const comets = [
  { top: '12%', delay: 0 },
  { top: '34%', delay: 5.5 },
  { top: '6%', delay: 11 },
  { top: '52%', delay: 16.5 },
]

export default function HeroFx() {
  return <div className="hero-fx" aria-hidden="true">
    <div className="fx-aurora"><i /><i /><i /></div>
    <div className="fx-rays"><i /><i /></div>
    <div className="fx-horizon"><i /></div>
    <div className="fx-bokeh">{bokeh.map((dot, index) => <i key={index} style={{ left: `${dot.left}%`, top: `${dot.top}%`, width: dot.size, height: dot.size, animationDelay: `${dot.delay}s`, animationDuration: `${dot.duration}s` }} />)}</div>
    <div className="fx-rings"><i /><i /><i /></div>
    <div className="fx-comets">{comets.map((comet, index) => <i key={index} style={{ top: comet.top, animationDelay: `${comet.delay}s` }} />)}</div>
    <div className="fx-flare"><i /></div>
  </div>
}
