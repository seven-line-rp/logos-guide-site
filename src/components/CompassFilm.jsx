import { useState } from 'react'

const parts = [
  ['case', 39],
  ['dial', 15],
  ['hand', -6],
  ['bezel', -26],
  ['lens', -43],
]

export default function CompassFilm() {
  const [loaded, setLoaded] = useState(0)
  return <div className="instrument-film" aria-hidden="true">
    <div className="instrument-shadow" />
    <div className="instrument-object" data-layered={loaded >= parts.length}>
      <img className="instrument-closed" src="/instrument/compass.webp" alt="" fetchPriority="high" />
      <div className="instrument-parts">
        {parts.map(([part, distance]) => <img
          key={part} src={`/instrument/part-${part}.webp`} alt=""
          style={{ '--distance': `${distance}%` }} onLoad={() => setLoaded(n => n + 1)}
        />)}
      </div>
    </div>
  </div>
}
