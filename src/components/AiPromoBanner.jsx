import { Link } from 'react-router-dom'
import { ArrowRight, Bot } from 'lucide-react'

// Плашка на главной со ссылкой на чат.
export default function AiPromoBanner() {
  return <section className="ai-promo-section container" aria-labelledby="ai-promo-title">
    <Link className="ai-promo" to="/ai">
      <span className="ai-promo-icon" aria-hidden="true"><Bot size={22} /></span>
      <span className="ai-promo-copy">
        <h2 id="ai-promo-title">ИИ-помощник</h2>
        <p>Можно спросить, где кабинет или как дойти. Работает на нейросети, так что иногда ошибается.</p>
      </span>
      <span className="ai-promo-button">Открыть чат <ArrowRight size={16} /></span>
    </Link>
  </section>
}
