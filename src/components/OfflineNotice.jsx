import { useSyncExternalStore } from 'react'
import { WifiOff } from 'lucide-react'

// Плашка «нет сети»: сайт продолжает работать из кэша сервис-воркера,
// но ИИ-агент и отправка сообщений без интернета недоступны.
const subscribe = (listener) => {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => { window.removeEventListener('online', listener); window.removeEventListener('offline', listener) }
}

export default function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true)
  if (online) return null
  return <div className="offline-notice" role="status"><WifiOff size={15} /> Нет сети — открыта сохранённая версия сайта.</div>
}
