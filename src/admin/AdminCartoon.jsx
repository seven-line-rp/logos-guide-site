import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import CartoonStage, { CARTOON_DURATION } from './CartoonStage.jsx'

// Вкладка «Мультик» в /admin: «Mr.Брекин спешит на помощь» — шуточный мультик
// про ЛОГОС, отдельно от промо-ролика. Готовое видео собирает
// scripts/render-promo.mjs --film=cartoon (docs/promo.md).
// ?render=1 — только сцена 1280×720 для съёмки кадров.

const VIDEO_URL = '/promo/cartoon/logos-cartoon.mp4'

function RenderOnly() {
  const [t, setT] = useState(0)
  useEffect(() => {
    window.__promoSeek = (value) => new Promise((resolve) => { setT(value); requestAnimationFrame(() => requestAnimationFrame(resolve)) })
    window.__promoDuration = CARTOON_DURATION
    return () => { delete window.__promoSeek; delete window.__promoDuration }
  }, [])
  return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000' }}><CartoonStage t={t} /></div>
}

export default function AdminCartoon() {
  const [params] = useSearchParams()
  if (params.get('render') === '1') return <RenderOnly />
  return <>
    <div className="adm-head">
      <div>
        <h1>Мультик</h1>
        <p>«Mr.Брекин спешит на помощь» — шуточный мультик на {Math.round(CARTOON_DURATION)} секунд: у студента не открывается ЛОГОС, а до пары минута. Герои ругаются матом, поэтому 18+.</p>
      </div>
    </div>
    <section className="adm-promo-player" aria-label="Мультик">
      <div className="adm-promo-screen">
        <video src={VIDEO_URL} poster="/promo/cartoon/poster.jpg" controls playsInline preload="metadata" />
      </div>
      <div className="adm-promo-export">
        <a className="adm-button adm-button-primary" href={VIDEO_URL} download="logos-cartoon.mp4"><Download size={16} /> Скачать MP4</a>
      </div>
    </section>
    <p className="adm-fine">Mr.Брекин VPN не существует, это шутка. Музыка сочинена скриптом (scripts/build-cartoon-music.py), голоса — Piper «Дмитрий» и «Денис» (CC0). Как пересобрать — docs/promo.md.</p>
  </>
}
