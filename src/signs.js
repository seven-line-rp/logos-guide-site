import { rooms } from './data.js'

// Общее для табличек «Вы здесь» (/here) и карточек на двери (/admin/cards).

export const roomName = (room) => `${room.name}${room.number ? ` №${room.number}` : ''}`

// Табличка нужна там, куда приходят люди: без лифтов, лестниц и самих входов.
export const signRooms = rooms.filter((room) => !/^(lift|stairs)-/.test(room.id))

export const hereLink = (origin, roomId) => `${origin}/here?room=${encodeURIComponent(roomId)}`

// Имя файла из названия помещения: без символов, которые запрещены в Windows.
export const signFileName = (room, ext = 'svg') => `${room.floor}-этаж_${roomName(room)}.${ext}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_')
