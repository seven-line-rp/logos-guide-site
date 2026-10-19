import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Printer, Share2, X } from 'lucide-react'
import { qrSvg, routeLink, shareOrCopy } from '../share.js'
import { lockBodyScroll } from '../storage.js'

// «Поделиться маршрутом»: ссылка, QR-код (навести камеру — и маршрут открыт)
// и печать листка с шагами для гостей и родителей.
export default function ShareRoute({ from, to, mode, title, meta, steps, manualStart, onClose }) {
  const url = routeLink(window.location.origin, { from, to, mode })
  const [svg, setSvg] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    let alive = true
    qrSvg(url).then((value) => { if (alive) setSvg(value) }).catch(() => {})
    return () => { alive = false }
  }, [url])
  useEffect(() => {
    const unlock = lockBodyScroll()
    const onKey = (event) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { unlock(); window.removeEventListener('keydown', onKey) }
  }, [onClose])

  const share = async () => {
    const result = await shareOrCopy({ title: 'Маршрут по колледжу', text: title, url })
    setStatus(result === 'copied' ? 'Ссылка скопирована' : result === 'failed' ? 'Не удалось скопировать' : '')
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setStatus('Ссылка скопирована') } catch { setStatus('Не удалось скопировать') }
  }

  // Окно — в body: у main анимация с transform, и position: fixed внутри
  // него считался бы от main, а не от окна.
  return createPortal(<div className="share-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-title">
      <button type="button" className="share-close" onClick={onClose} aria-label="Закрыть"><X size={18} /></button>
      <span className="eyebrow">Поделиться маршрутом</span>
      <h2 id="share-title">{title}</h2>
      <p className="share-meta">{meta}</p>
      <div className="share-body">
        <div className="share-qr" aria-label="QR-код маршрута" role="img" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="share-side">
          <p>Наведите камеру телефона на код, и маршрут откроется.{manualStart ? ' Ваша отметка есть только на этом устройстве, поэтому в ссылке старт от главного входа.' : ''}</p>
          <div className="share-link"><span>{url.replace(/^https?:\/\//, '')}</span><button type="button" onClick={copy} aria-label="Скопировать ссылку">{status === 'Ссылка скопирована' ? <Check size={15} /> : <Copy size={15} />}</button></div>
          <div className="share-actions">
            <button type="button" className="share-primary" onClick={share}><Share2 size={16} /> Отправить</button>
            <button type="button" onClick={() => window.print()}><Printer size={16} /> Распечатать</button>
          </div>
          {status && <small className="share-status" role="status">{status}</small>}
        </div>
      </div>
      {/* Листок для печати: QR, сводка и шаги. На экране скрыт. */}
      <ol className="share-print-steps">{steps.map((step, index) => <li key={index}><strong>{step.title}</strong> {step.detail}</li>)}</ol>
    </section>
  </div>, document.body)
}
