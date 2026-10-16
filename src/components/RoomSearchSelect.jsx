import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, MapPin, Search } from 'lucide-react'
import { floors, rooms } from '../data.js'

// Поиск кабинета для построения маршрута: вместо длинного <select> — поле
// с живой фильтрацией. Ищем по названию, номеру, псевдонимам и категории;
// точный номер кабинета всегда сильнее остальных совпадений.

const normalize = (value) => String(value ?? '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()

export function roomLabel(room) {
  return `${room.name}${room.number ? ` №${room.number}` : ''}`
}

function scoreRoom(room, query, digits) {
  const name = normalize(room.name)
  const aliases = normalize(room.aliases)
  if (digits && room.number) {
    const numberDigits = room.number.replace(/\D/g, '')
    if (numberDigits) {
      if (numberDigits === digits) return 200
      if (numberDigits.startsWith(digits)) return 150
      if (numberDigits.includes(digits)) return 90
    }
  }
  if (!query) return 1
  if (name.startsWith(query)) return 120
  const words = `${name} ${aliases}`.split(' ')
  if (words.some((word) => word.startsWith(query))) return 100
  if (name.includes(query) || aliases.includes(query)) return 70
  if (normalize(room.category).includes(query)) return 40
  return 0
}

export default function RoomSearchSelect({ label, value, onChange, manualOption = null }) {
  const listId = useId()
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const selectedRoom = rooms.find((room) => room.id === value) || null
  const isManual = Boolean(manualOption) && value === manualOption.value
  const selectedLabel = isManual ? manualOption.label : selectedRoom ? roomLabel(selectedRoom) : ''

  // Плоский список — по нему двигается подсветка стрелками; группы — для
  // заголовков «Первый этаж / Второй этаж» внутри выпадающего списка.
  const { groups, flat } = useMemo(() => {
    const normalized = normalize(query)
    const digits = normalized.replace(/\D/g, '')
    const scored = rooms
      .map((room) => ({ room, score: scoreRoom(room, normalized, digits) }))
      .filter((entry) => entry.score > 0)
      .sort((first, second) => second.score - first.score)
    const nextGroups = floors
      .map((floor) => ({ floor, items: scored.filter((entry) => entry.room.floor === floor.id) }))
      .filter((group) => group.items.length)
    const nextFlat = []
    if (manualOption) nextFlat.push({ id: manualOption.value, manual: true })
    for (const group of nextGroups) for (const entry of group.items) nextFlat.push({ id: entry.room.id })
    return { groups: nextGroups, flat: nextFlat }
  }, [query, manualOption])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  })

  // При открытии подсветка встаёт на выбранную комнату, а не на первый пункт.
  useEffect(() => {
    if (!open) return
    const index = flat.findIndex((entry) => entry.id === value)
    setHighlight(index >= 0 ? index : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector(`[data-option-index="${highlight}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  const openList = () => {
    if (open) return
    setOpen(true)
    setQuery('')
  }

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const pick = (id) => {
    onChange(id)
    close()
    inputRef.current?.blur()
  }

  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); inputRef.current?.blur(); return }
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') { event.preventDefault(); openList() }
      return
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setHighlight((index) => Math.min(flat.length - 1, index + 1)) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setHighlight((index) => Math.max(0, index - 1)) }
    else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = flat[highlight]
      if (entry) pick(entry.id)
    }
  }

  let renderIndex = -1
  const optionRow = (id, index, content, manual = false) => {
    const selected = id === value
    const highlighted = index === highlight
    return <button
      type="button"
      key={id}
      role="option"
      id={`${listId}-option-${index}`}
      data-option-index={index}
      aria-selected={selected}
      className={`route-room-option ${highlighted ? 'route-room-option-highlight' : ''} ${selected ? 'route-room-option-selected' : ''} ${manual ? 'route-room-option-manual' : ''}`}
      tabIndex={-1}
      // Выбираем уже на pointerdown: preventDefault не даёт вводу потерять
      // фокус (blur-обработчик не успевает закрыть список), а на тач-устройствах
      // не приходится ждать синтетического click.
      onPointerDown={(event) => { event.preventDefault(); pick(id) }}
      onMouseEnter={() => setHighlight(index)}
    >{content}</button>
  }

  return <div className={`route-room-search ${open ? 'route-room-search-open' : ''}`} ref={rootRef}>
    <span className="route-room-search-label" id={`${listId}-label`}>{label}</span>
    <div
      className="route-room-search-field"
      onPointerDown={(event) => {
        // Клик по любой точке поля (иконка, отступы) фокусирует ввод и
        // открывает список; открытый список кликом по полю не закрываем.
        if (!open && event.target !== inputRef.current) {
          event.preventDefault()
          inputRef.current?.focus()
        }
      }}
    >
      <Search size={16} strokeWidth={2} aria-hidden="true" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && flat[highlight] ? `${listId}-option-${highlight}` : undefined}
        aria-labelledby={`${listId}-label`}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        placeholder={open ? 'Кабинет, номер или название' : ''}
        value={open ? query : selectedLabel}
        readOnly={!open}
        onFocus={openList}
        onChange={(event) => { setQuery(event.target.value); setHighlight(0) }}
        onKeyDown={onKeyDown}
        onBlur={(event) => {
          if (rootRef.current && !rootRef.current.contains(event.relatedTarget)) close()
        }}
      />
      {!open && (selectedRoom || isManual) && <span className="route-room-search-floor">{isManual ? 'метка' : `${selectedRoom.floor} этаж`}</span>}
      <button
        type="button"
        className="route-room-search-chevron"
        tabIndex={-1}
        aria-label={open ? 'Закрыть список кабинетов' : 'Открыть список кабинетов'}
        onClick={() => {
          if (open) { close(); inputRef.current?.blur() } else inputRef.current?.focus()
        }}
      >
        <ChevronDown size={15} aria-hidden="true" />
      </button>
    </div>
    {open && <div className="route-room-search-list" role="listbox" id={listId} aria-label={label} ref={listRef}>
      {manualOption && (() => {
        renderIndex += 1
        return optionRow(manualOption.value, renderIndex, <>
          <span className="route-room-option-main"><MapPin size={14} /> <strong>{manualOption.label}</strong></span>
          <span className="route-room-option-floor">метка на плане</span>
        </>, true)
      })()}
      {groups.map((group) => <div className="route-room-search-group" key={group.floor.id}>
        <div className="route-room-search-group-label" aria-hidden="true">{group.floor.label}<small>{group.floor.hint}</small></div>
        {group.items.map(({ room }) => {
          renderIndex += 1
          const index = renderIndex
          return optionRow(room.id, index, <>
            <span className="route-room-option-main">
              <strong>{room.name}</strong>
              {room.number && <em className="route-room-option-number">№{room.number}</em>}
            </span>
            <span className="route-room-option-floor">{room.floor} этаж</span>
          </>)
        })}
      </div>)}
      {flat.length === 0 && <div className="route-room-search-empty">Ничего не нашлось. Попробуйте номер кабинета или слово — например, «физика» или «туалет».</div>}
    </div>}
  </div>
}
