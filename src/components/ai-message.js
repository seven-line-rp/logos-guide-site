import { createElement as h, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Check, CircleCheck, ClipboardList, Copy, CornerDownRight, Info, Lightbulb, ListChecks, PencilRuler, PenLine, ShieldCheck, Sigma, Target, TriangleAlert } from 'lucide-react'
import { parseBlocks, parseInline } from '../ai-chat.js'
import { SUBJECTS, splitSubject } from '../ai-format.js'
import { AiChart } from './ai-chart.js'
import { Tex } from './ai-math.js'
import { AiQuiz } from './ai-quiz.js'

// Текст сообщений чата. Файл .js, а не .jsx, специально: localize-jsx
// переводит все строки в JSX, а реплики собеседника и ИИ переводить нельзя —
// иначе в английской версии ответ превратится в смесь двух языков.

function inline(text, key) {
  return parseInline(text).map((part, index) => {
    const id = `${key}-${index}`
    if (part.type === 'strong') return h('strong', { key: id }, inline(part.text, id))
    if (part.type === 'em') return h('em', { key: id }, part.text)
    if (part.type === 'math') return h(Tex, { key: id, tex: part.text })
    if (part.type === 'code') return h('code', { key: id }, part.text)
    if (part.type === 'link') {
      return part.internal
        ? h(Link, { key: id, to: part.href }, part.text)
        : h('a', { key: id, href: part.href, target: '_blank', rel: 'noopener noreferrer' }, part.text)
    }
    return part.text
  })
}

function CodeBlock({ lang, text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600) } catch { /* буфер недоступен */ }
  }
  return h('div', { className: 'ai-code' },
    h('div', { className: 'ai-code-top' }, h('span', null, lang || 'код'), h('button', { type: 'button', onClick: copy, 'aria-label': 'Скопировать код' }, h(copied ? Check : Copy, { size: 13 }), copied ? 'Готово' : 'Копировать')),
    h('pre', null, h('code', null, text)))
}

// Значки плашек и заголовков: сайт рисует их сам, модель только пишет подпись.
export const CALLOUT_ICONS = {
  summary: Target, given: ClipboardList, solution: ListChecks, answer: CircleCheck, definition: BookOpen,
  rule: Sigma, warn: TriangleAlert, example: PenLine, tip: Lightbulb, check: ShieldCheck, note: Info,
}
const CALLOUT_TITLES = { summary: 'Кратко', given: 'Дано', solution: 'Решение', answer: 'Ответ', definition: 'Определение', rule: 'Правило', warn: 'Важно', example: 'Пример', tip: 'Совет', check: 'Проверка', note: 'Заметка' }

const headingIcons = [
  [/теори|основ|понят|определен/i, BookOpen],
  [/практик|задани|закреп|тренир/i, PencilRuler],
  [/ошибк|внимани|важно|осторожн/i, TriangleAlert],
  [/формул|закон|правил/i, Sigma],
  [/пример|разбор/i, PenLine],
  [/вывод|итог|результат|ответ/i, CircleCheck],
  [/совет|лайфхак|подсказ/i, Lightbulb],
  [/алгоритм|шаг|порядок|как /i, ListChecks],
]
export function headingIcon(text) {
  for (const [pattern, icon] of headingIcons) if (pattern.test(text)) return icon
  return null
}

function renderBlocks(blocks, prefix = 'b', ctx = {}) {
  return blocks.map((block, index) => {
    const key = `${prefix}${index}`
    if (block.type === 'ul' || block.type === 'ol') return h(block.type, { key }, block.items.map((item, i) => h('li', { key: i }, inline(item, `${key}-${i}`))))
    if (block.type === 'code') return h(CodeBlock, { key, lang: block.lang, text: block.text })
    if (block.type === 'math') return h(Tex, { key, tex: block.text, display: true })
    if (block.type === 'chart') return h(AiChart, { key, spec: block.spec })
    if (block.type === 'quiz') return h(AiQuiz, { key, spec: block.spec, render: inline, onAsk: ctx.onAsk })
    if (block.type === 'next') return ctx.onAsk ? h('div', { key, className: 'ai-next', role: 'group', 'aria-label': 'Что спросить дальше' }, block.items.map((item) => h('button', { key: item, type: 'button', className: 'ai-next-item', onClick: () => ctx.onAsk(item) }, h(CornerDownRight, { size: 14, 'aria-hidden': true }), h('span', null, item)))) : null
    if (block.type === 'hr') return h('hr', { key, className: 'ai-rule' })
    if (block.type === 'callout') {
      const Icon = CALLOUT_ICONS[block.kind] || Info
      return h('div', { key, className: `ai-callout ai-callout-${block.kind}`, role: 'note' },
        h('div', { className: 'ai-callout-head' }, h(Icon, { size: 16, 'aria-hidden': true }), h('strong', null, block.label || CALLOUT_TITLES[block.kind])),
        h('div', { className: 'ai-callout-body' }, renderBlocks(block.blocks, `${key}-`, ctx)))
    }
    if (block.type === 'table') {
      const align = (i) => (block.aligns[i] ? { style: { textAlign: block.aligns[i] } } : null)
      return h('div', { key, className: 'ai-table-wrap' }, h('table', { className: 'ai-table' },
        h('thead', null, h('tr', null, block.head.map((cell, i) => h('th', { key: i, scope: 'col', ...align(i) }, inline(cell, `${key}-h${i}`))))),
        h('tbody', null, block.rows.map((row, r) => h('tr', { key: r }, block.head.map((_, i) => h('td', { key: i, ...align(i) }, inline(row[i] || '', `${key}-${r}-${i}`))))))))
    }
    if (block.type === 'h') {
      const Icon = headingIcon(block.text)
      return h('p', { key, className: `ai-message-heading${Icon ? ' ai-message-heading-icon' : ''}` }, Icon ? h('span', { className: 'ai-heading-mark', 'aria-hidden': true }, h(Icon, { size: 16 })) : null, h('strong', null, inline(block.text, key)))
    }
    return h('p', { key }, inline(block.text, key))
  })
}

// Предмет ответа (метка [[предмет: math]] в начале) — страница красит карточку.
export function messageSubject(text) {
  return splitSubject(text).subject
}

export function AiMessageText({ text, plain = false, onAsk }) {
  if (plain) return h('p', null, text)
  const { subject, text: body } = splitSubject(text)
  const blocks = renderBlocks(parseBlocks(body), 'b', { onAsk })
  return subject ? [h('span', { key: 'subject', className: 'ai-subject-badge' }, SUBJECTS[subject]), ...blocks] : blocks
}

// Пользовательский текст вне сообщений (названия чатов): тоже без перевода.
export function RawText({ text }) {
  return text
}
