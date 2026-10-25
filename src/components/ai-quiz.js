import { createElement as h, useState } from 'react'
import { Check, CircleCheck, CircleX, Eye, Info, PencilRuler, RotateCcw, Trophy, ArrowRight } from 'lucide-react'
import { checkAnswer } from '../ai-quiz.js'

// Практические задания в ответе ИИ: выбор варианта или поле для ввода, проверка
// на месте, разбор и итог. Файл .js, а не .jsx, специально: тексты заданий
// пришли от модели, и localize-jsx не должен их «переводить» (см. ai-message.js).

const LETTERS = ['А', 'Б', 'В', 'Г', 'Д', 'Е']

function Task({ task, index, state, value, onChange, onCheck, onShow, render }) {
  const key = `q${index}`
  const final = state === 'ok' || state === 'shown' || (state === 'bad' && task.type === 'choice')
  const picked = task.type === 'choice' && value !== '' ? Number(value) : -1
  const input = task.type === 'input'
    ? h('div', { className: 'ai-quiz-input' },
      h('input', {
        type: 'text', value, disabled: final, autoComplete: 'off', spellCheck: false, 'aria-label': `Ответ на задание ${index + 1}`, placeholder: 'Ваш ответ',
        className: state === 'ok' ? 'is-ok' : state === 'bad' ? 'is-bad' : '',
        onChange: (event) => onChange(event.target.value),
        onKeyDown: (event) => { if (event.key === 'Enter') { event.preventDefault(); onCheck() } },
      }),
      !final && h('button', { type: 'button', className: 'ai-quiz-check', disabled: !String(value).trim(), onClick: onCheck }, 'Проверить'))
    : h('div', { className: 'ai-quiz-options', role: 'group', 'aria-label': `Варианты к заданию ${index + 1}` }, task.options.map((option, i) => {
      const correct = final && i === task.answer
      const wrong = state === 'bad' && i === picked
      return h('button', {
        key: i, type: 'button', disabled: final, className: `ai-quiz-option${correct ? ' is-ok' : ''}${wrong ? ' is-bad' : ''}`,
        onClick: () => onCheck(i),
      }, h('span', { className: 'ai-quiz-letter' }, correct ? h(Check, { size: 13, 'aria-hidden': true }) : wrong ? h(CircleX, { size: 13, 'aria-hidden': true }) : LETTERS[i]), h('span', null, render(option, `${key}-o${i}`)))
    }))
  const verdict = state === 'ok' ? h('p', { className: 'ai-quiz-verdict is-ok' }, h(CircleCheck, { size: 15, 'aria-hidden': true }), 'Верно')
    : state === 'bad' ? h('p', { className: 'ai-quiz-verdict is-bad' }, h(CircleX, { size: 15, 'aria-hidden': true }), task.type === 'choice' ? 'Неверно' : 'Пока неверно: проверьте запись и попробуйте ещё раз')
      : null
  const answerText = task.type === 'choice' ? task.options[task.answer] : task.answer
  return h('li', { className: `ai-quiz-task${state ? ` is-${state}` : ''}` },
    h('div', { className: 'ai-quiz-question' }, h('span', { className: 'ai-quiz-num' }, index + 1), h('div', null, render(task.q, key))),
    input,
    verdict,
    state === 'bad' && !final && h('button', { type: 'button', className: 'ai-quiz-link', onClick: onShow }, h(Eye, { size: 14, 'aria-hidden': true }), 'Показать ответ'),
    final && h('div', { className: 'ai-quiz-explain' },
      h('div', { className: 'ai-quiz-explain-head' }, h(Info, { size: 15, 'aria-hidden': true }), h('strong', null, 'Правильный ответ: '), h('span', null, render(answerText, `${key}-a`))),
      task.explain && h('div', { className: 'ai-quiz-explain-text' }, render(task.explain, `${key}-e`))))
}

export function AiQuiz({ spec, render, onAsk }) {
  const [values, setValues] = useState({})
  const [results, setResults] = useState({})
  const total = spec.tasks.length
  const finals = Object.fromEntries(Object.entries(results).filter(([i, state]) => state === 'ok' || state === 'shown' || (state === 'bad' && spec.tasks[i].type === 'choice')))
  const correct = Object.values(results).filter((state) => state === 'ok').length
  const finished = Object.keys(finals).length >= total

  const check = (index, picked) => {
    const task = spec.tasks[index]
    const value = task.type === 'choice' ? picked : values[index] ?? ''
    if (task.type === 'choice') setValues((current) => ({ ...current, [index]: String(picked) }))
    setResults((current) => ({ ...current, [index]: checkAnswer(task, value) ? 'ok' : 'bad' }))
  }
  const reset = () => { setValues({}); setResults({}) }

  return h('section', { className: 'ai-quiz', 'aria-label': 'Практические задания' },
    h('header', { className: 'ai-quiz-head' },
      h('span', { className: 'ai-quiz-icon', 'aria-hidden': true }, h(PencilRuler, { size: 17 })),
      h('div', null, h('strong', null, 'Проверьте себя'), h('small', null, spec.title || `${total} ${total === 1 ? 'задание' : total < 5 ? 'задания' : 'заданий'} для самопроверки`)),
      h('span', { className: 'ai-quiz-progress', 'aria-live': 'polite' }, `${Object.keys(finals).length} / ${total}`)),
    h('ol', { className: 'ai-quiz-list' }, spec.tasks.map((task, i) => h(Task, {
      key: i, task, index: i, state: results[i], value: values[i] ?? '', render,
      onChange: (value) => { setValues((current) => ({ ...current, [i]: value })); if (results[i] === 'bad') setResults((current) => { const next = { ...current }; delete next[i]; return next }) },
      onCheck: (picked) => check(i, picked),
      onShow: () => setResults((current) => ({ ...current, [i]: 'shown' })),
    }))),
    finished && h('footer', { className: 'ai-quiz-result' },
      h('span', { className: 'ai-quiz-trophy', 'aria-hidden': true }, h(Trophy, { size: 18 })),
      h('div', null, h('strong', null, `Результат: ${correct} из ${total}`), h('small', null, correct === total ? 'Отлично, тема усвоена.' : correct >= Math.ceil(total / 2) ? 'Хороший результат. Разберите ошибки выше и повторите.' : 'Стоит повторить теорию и пройти задания ещё раз.')),
      h('div', { className: 'ai-quiz-actions' },
        h('button', { type: 'button', onClick: reset }, h(RotateCcw, { size: 14, 'aria-hidden': true }), 'Пройти заново'),
        onAsk && h('button', { type: 'button', className: 'is-primary', onClick: () => onAsk('Дай ещё 5 других заданий для самопроверки по этой теме') }, 'Ещё задания', h(ArrowRight, { size: 14, 'aria-hidden': true })))))
}
