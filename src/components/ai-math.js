import { createElement as h, useEffect, useState } from 'react'
import { isLitePerf } from '../perf.js'

// Формулы LaTeX в ответах ИИ. KaTeX (около 260 КБ со шрифтами) грузится
// только когда в ответе встретилась формула, а до загрузки — и если сети нет —
// показывается сам текст формулы. Файл .js: строки здесь не переводятся.

let katexPromise
function loadKatex() {
  katexPromise ||= Promise.all([import('katex'), import('../katex-lite.css')]).then(([module]) => module.default)
  katexPromise.catch(() => { katexPromise = undefined })
  return katexPromise
}

export function Tex({ tex, display = false }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    let alive = true
    loadKatex().then((katex) => {
      if (!alive) return
      try {
        setHtml(katex.renderToString(tex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 300, output: isLitePerf() ? 'html' : 'htmlAndMathml' }))
      } catch { setHtml('') }
    }).catch(() => {})
    return () => { alive = false }
  }, [tex, display])
  const className = display ? 'ai-math ai-math-block' : 'ai-math'
  if (html) return h(display ? 'div' : 'span', { className, dangerouslySetInnerHTML: { __html: html } })
  return h(display ? 'div' : 'span', { className: `${className} ai-math-raw` }, h('code', null, tex))
}
