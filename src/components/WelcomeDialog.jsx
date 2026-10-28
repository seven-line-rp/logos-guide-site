import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Compass, Construction, X } from 'lucide-react'
import { lockBodyScroll, storageGet, storageSet } from '../storage.js'
import { startTour } from '../tour-bus.js'
import { readTutorialDone } from '../tutorial.js'

export const WELCOME_HIDDEN_KEY = 'logos-welcome-hidden'

function readHidden() {
  return storageGet(WELCOME_HIDDEN_KEY) === '1'
}

export default function WelcomeDialog() {
  const [open, setOpen] = useState(() => !readHidden())
  const [dontShow, setDontShow] = useState(false)
  const [tourDone] = useState(() => readTutorialDone())
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const timer = window.setTimeout(() => closeRef.current?.focus(), 40)
    const unlock = lockBodyScroll()
    const onKeyDown = (event) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      unlock()
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!open) return null

  const close = () => {
    if (dontShow) {
      storageSet(WELCOME_HIDDEN_KEY, '1')
    }
    setOpen(false)
  }

  return (
    <div className="welcome-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <section className="welcome-dialog" role="dialog" aria-modal="true" aria-labelledby="welcome-title" aria-describedby="welcome-text">
        <button className="icon-button welcome-close" onClick={close} aria-label="Закрыть приветствие"><X size={18} /></button>
        <span className="welcome-badge"><Construction size={15} /> Сайт в разработке</span>
        <h2 id="welcome-title">Добро пожаловать в «ЛОГОС»!</h2>
        <p id="welcome-text">
          Путеводитель ещё дорабатывается, поэтому иногда могут встречаться ошибки.
          Если заметите баг или неточность на карте, сообщите{' '}
          <Link to="/about" onClick={close}>команде проекта</Link>: так мы быстрее всё исправим.
        </p>

        <label className="welcome-toggle">
          <input type="checkbox" checked={dontShow} onChange={(event) => setDontShow(event.target.checked)} />
          <i className="welcome-switch" aria-hidden="true"><b /></i>
          <span>Больше не показывать</span>
        </label>

        <div className="welcome-actions">
          {!tourDone && <button className="button welcome-tour" onClick={() => { close(); startTour() }}><Compass size={16} /> Пройти обучение</button>}
          <button ref={closeRef} className="button button-primary welcome-submit" onClick={close}>Понятно, к карте!</button>
        </div>
      </section>
    </div>
  )
}
