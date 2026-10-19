import { useCallback, useSyncExternalStore } from 'react'
import { Star } from 'lucide-react'
import { readFavorites, readRecent, subscribePlaces, toggleFavorite } from '../places.js'

// Избранное и недавние маршруты как живые данные: звёздочка на любой
// странице сразу обновляет блок «Мои места» на главной.
let favoritesSnapshot = null
let recentSnapshot = null
const favoritesKey = () => JSON.stringify(readFavorites())
const recentKey = () => JSON.stringify(readRecent())

function getFavorites() {
  const key = favoritesKey()
  if (!favoritesSnapshot || favoritesSnapshot.key !== key) favoritesSnapshot = { key, value: JSON.parse(key) }
  return favoritesSnapshot.value
}

function getRecent() {
  const key = recentKey()
  if (!recentSnapshot || recentSnapshot.key !== key) recentSnapshot = { key, value: JSON.parse(key) }
  return recentSnapshot.value
}

export function useFavorites() {
  return useSyncExternalStore(subscribePlaces, getFavorites, () => [])
}

export function useRecentRoutes() {
  return useSyncExternalStore(subscribePlaces, getRecent, () => [])
}

export function useFavorite(id) {
  const favorites = useFavorites()
  const toggle = useCallback(() => toggleFavorite(id), [id])
  return [favorites.includes(id), toggle]
}

export default function FavoriteButton({ id, className = '' }) {
  const [on, toggle] = useFavorite(id)
  return <button type="button" className={`fav-button ${on ? 'is-on' : ''} ${className}`} onClick={toggle} aria-pressed={on} aria-label={on ? 'Убрать из избранного' : 'Добавить в избранное'} title={on ? 'Убрать из избранного' : 'В избранное'}>
    <Star size={16} fill={on ? 'currentColor' : 'none'} />
    <span>{on ? 'В избранном' : 'В избранное'}</span>
  </button>
}
