import { createElement as h, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { parseBlocks, parseInline } from '../ai-chat.js'

// Текст сообщений чата. Файл .js, а не .jsx, специально: localize-jsx
// переводит все строки в JSX, а реплики собеседника и ИИ переводить нельзя —
// иначе в английской версии ответ превратится в смесь двух языков.

function inline(text, key) {
  return parseInline(text).map((part, index) => {
    const id = `${key}-${index}`
    if (part.type === 'strong') return h('strong', { key: id }, part.text)
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

export function AiMessageText({ text, plain = false }) {
  if (plain) return h('p', null, text)
  return parseBlocks(text).map((block, index) => {
    const key = `b${index}`
    if (block.type === 'ul' || block.type === 'ol') return h(block.type, { key }, block.items.map((item, i) => h('li', { key: i }, inline(item, `${key}-${i}`))))
    if (block.type === 'code') return h(CodeBlock, { key, lang: block.lang, text: block.text })
    if (block.type === 'h') return h('p', { key, className: 'ai-message-heading' }, h('strong', null, inline(block.text, key)))
    return h('p', { key }, inline(block.text, key))
  })
}

// Пользовательский текст вне сообщений (названия чатов): тоже без перевода.
export function RawText({ text }) {
  return text
}
