// Coordinates are in the viewBox of the original floor SVGs. Keep these bounds,
// the clickable areas and the routing doorways in sync when changing the plan.
//
// The room shapes on the plan are drawn from these boxes (see map-art.js), so
// they are the single source of truth for every wall: neighbouring rooms share
// one exact edge and never overlap. The coordinates are snapped to a handful of
// wall lines per floor (corridor edges, row tops and bottoms, wing columns);
// when the plan changes, move the shared line for every room on it at once.
//
// Floor 1: top row y=93.5…155.5, corridor 155.5…179.5, second row 179.5…241.5,
//   west wing columns x=0…62 and x=86…149.3 around the corridor x=62…86.
// Floor 2: top row y=95.5…156.5, corridor 156.5…182.2, second row 182.2…244.9,
//   west wing columns x=0…62 and x=86…148.
export const planSizes = {
  1: { width: 758, height: 552 },
  2: { width: 767, height: 561 },
}

export const planRoomBounds = {
  canteen: [0, 0, 147.7, 155.5],
  'workshop-115': [147.7, 93.5, 108.3, 62],
  'simulator-114': [256, 93.5, 84, 62],
  'academic-office': [340, 93.5, 184, 62],
  'lift-1': [524, 93.5, 25, 62],
  'stairs-north-1': [549, 93.5, 60.7, 62],
  'auditorium-104': [609.7, 93.5, 147.3, 148],
  'class-119': [0, 179.5, 62, 72.5],
  'class-118': [0, 252, 62, 70],
  'toilet-men-1': [86, 179.5, 81.9, 31],
  'toilet-women-1': [86, 210.5, 81.9, 31],
  'language-148': [167.9, 179.5, 76.1, 62],
  'aerodynamics-120': [244, 179.5, 73.6, 62],
  // The central staircase on the first floor covers the landing shaft
  // (x=317.6…336.5) and the lower flight (x=336.5…383.4, y=209.7…241.5).
  // The director's office wraps around it: top cell "КАБ." (x=336.5…383.4, y=179.5…209.7)
  // plus the main office "ДИРЕКТОРА" (x=383.4…449, y=179.5…241.5).
  'stairs-middle-1': [317.6, 179.5, 65.8, 62],
  'director-149': [336.5, 179.5, 112.5, 62],
  'changing-room': [449, 179.5, 99, 62],
  'hall-1': [548, 179.5, 61.7, 62],
  'entrance-1': [548, 241.5, 61.7, 22.2],
  'stairs-west-1': [0, 322, 62, 62],
  'class-139': [86, 306, 63.3, 68.4],
  'class-138': [86, 374.4, 63.3, 68.3],
  // Медицинский блок под кабинетом 138: медпункт примыкает к коридору
  // западного крыла, кабинет врача — отдельная комната за медпунктом.
  'medical-post': [86, 442.7, 33, 25.3],
  'medical-doctor': [119, 442.7, 30.3, 25.3],
  'class-162': [0, 419, 62, 49],
  'training-centre-113': [0, 468, 149.3, 84],

  'library-214': [0, 0, 144.5, 113],
  'radio-lab-228': [144.5, 95.5, 113.6, 61],
  'electro-radio-230': [258.1, 95.5, 98.5, 61],
  'assistant-230': [356.6, 95.5, 68.9, 61],
  'uav-lab-209': [425.5, 95.5, 109.1, 61],
  'lift-2': [534.6, 95.5, 26.2, 61],
  'stairs-north-2': [560.8, 95.5, 49, 61],
  'meteorology-236': [0, 182.2, 62, 98.1],
  'toilet-men-2': [86, 182.2, 62, 31.6],
  'toilet-women-2': [86, 213.8, 62, 31.1],
  'physics-211': [168.3, 182.2, 153.9, 62.7],
  'stairs-middle-2': [322.2, 182.2, 70.3, 62.7],
  'psychologist-224': [392.5, 182.2, 33, 62.7],
  'class-217': [425.5, 182.2, 54.2, 62.7],
  'class-229': [479.7, 182.2, 32, 62.7],
  'informatics-222': [511.7, 182.2, 49.1, 62.7],
  // The western staircase on the second floor starts below the grey shaft
  // and ends where room 207 begins.
  'stairs-west-2': [0, 331.2, 62, 85.8],
  'chemistry-biology-202': [86, 244.9, 62, 83.1],
  'assistant-202': [86, 328, 62, 55.5],
  'practical-225': [86, 383.5, 62, 33.5],
  // Room 207 wraps around the corridor's lower end; room 225 is rectangular.
  'electrical-lab-207': [0, 417, 86, 143],
  'biotech-lab-225': [86, 417, 62, 143],
}

export const irregularRooms = {
  'electrical-lab-207': [[0, 417], [62, 417], [62, 477], [86, 477], [86, 560], [0, 560]],
  'stairs-middle-1': [[317.6, 179.5], [336.5, 179.5], [336.5, 209.7], [383.4, 209.7], [383.4, 241.5], [317.6, 241.5]],
  'director-149': [[336.5, 179.5], [449, 179.5], [449, 241.5], [383.4, 241.5], [383.4, 209.7], [336.5, 209.7]],
}

// Drawn parts of the plan that are not places: technical shafts (grey), the
// eastern staircase of the second floor (it only leads to the entrance hall)
// and the gallery over the assembly hall. They share wall lines with the rooms.
export const planDecor = {
  1: [
    { kind: 'shaft', box: [86, 241.5, 63.3, 64.5] },
  ],
  2: [
    { kind: 'shaft', box: [148, 182.2, 20.3, 62.7] },
    { kind: 'shaft', box: [0, 280.3, 62, 50.9] },
    { kind: 'room', box: [560.8, 182.2, 49, 62.7] },
    { kind: 'room', box: [609.8, 138.8, 22.1, 62.7] },
  ],
}

export function roomOutline(id) {
  if (irregularRooms[id]) return irregularRooms[id]
  const bounds = planRoomBounds[id]
  if (!bounds) return []
  const [x, y, width, height] = bounds
  return [[x, y], [x + width, y], [x + width, y + height], [x, y + height]]
}

// Main corridor: y=168, west wing: x=73. The other two branches are the
// first-floor entrance hall and the second-floor lobby under the library.
// Only these surveyed circulation lines are used for routing; no straight
// line is drawn through rooms to reach a 'nearest node'.
export const circulation = {
  1: [
    // The drawn corridor is the white band y=155.5…179.5; the lower edge is
    // 180 so that rows whose wall centre line sits at 179.0-179.7 stay connected
    // to the corridor (a hairline gap made a route look like it left the plan).
    [[0, 155.5], [610, 155.5], [610, 180], [0, 180]],
    [[62, 179], [86, 179], [86, 468], [62, 468]],
    [[548, 179], [610, 179], [610, 242], [548, 242]],
  ],
  2: [
    [[0, 114], [144, 114], [144, 182], [0, 182]],
    [[144, 156], [610, 156], [610, 182], [144, 182]],
    [[62, 182], [86, 182], [86, 477], [62, 477]],
  ],
}

// The point on each wall where the room meets a real corridor. 'west' doors
// face x=73; 'main' doors face y=168. Special branches have explicit paths.
export const roomAccess = {
  canteen: { door: [94, 156], branch: 'main' },
  'workshop-115': { door: [230, 156], branch: 'main' },
  'simulator-114': { door: [279, 156], branch: 'main' },
  'academic-office': { door: [412, 156], branch: 'main' },
  'lift-1': { door: [537, 156], branch: 'main' },
  'stairs-north-1': { door: [579, 156], branch: 'main' },
  // The auditorium opens off the entrance hall, not straight through its
  // north wall at the far end of the main corridor.
  'auditorium-104': { door: [610, 205], branch: 'auditorium' },
  'class-119': { door: [62, 246], branch: 'west' },
  'class-118': { door: [62, 294], branch: 'west' },
  'toilet-men-1': { door: [86, 205], branch: 'west' },
  'toilet-women-1': { door: [86, 237], branch: 'west' },
  'language-148': { door: [183, 181], branch: 'main' },
  'aerodynamics-120': { door: [261, 181], branch: 'main' },
  'stairs-middle-1': { door: [327, 181], branch: 'main' },
  'director-149': { door: [359, 181], branch: 'main' },
  'changing-room': { door: [505, 181], branch: 'main' },
  'hall-1': { door: [579, 179], branch: 'hall' },
  'entrance-1': { door: [579, 241], branch: 'hall' },
  'stairs-west-1': { door: [62, 354], branch: 'west' },
  'class-139': { door: [86, 367], branch: 'west' },
  'class-138': { door: [86, 434], branch: 'west' },
  // В медпункт — дверь из коридора; в кабинет врача — через медпункт
  // (на плане между ними нарисована отдельная дверь), поэтому маршрут
  // законно проходит по медпункту: это указано в `via`.
  'medical-post': { door: [86, 455], branch: 'west' },
  'medical-doctor': { door: [121, 455], branch: 'west', via: 'medical-post' },
  'class-162': { door: [62, 450], branch: 'west' },
  'training-centre-113': { door: [73, 468], branch: 'west' },

  'library-214': { door: [116, 114], branch: 'library' },
  'radio-lab-228': { door: [217, 156], branch: 'main' },
  'electro-radio-230': { door: [317, 156], branch: 'main' },
  'assistant-230': { door: [390, 156], branch: 'main' },
  'uav-lab-209': { door: [459, 156], branch: 'main' },
  'lift-2': { door: [548, 156], branch: 'main' },
  'stairs-north-2': { door: [585, 156], branch: 'main' },
  'meteorology-236': { door: [62, 246], branch: 'west' },
  'toilet-men-2': { door: [86, 193], branch: 'west' },
  'toilet-women-2': { door: [86, 224], branch: 'west' },
  'physics-211': { door: [249, 182], branch: 'main' },
  'stairs-middle-2': { door: [355, 182], branch: 'main' },
  'psychologist-224': { door: [409, 182], branch: 'main' },
  'class-217': { door: [440, 182], branch: 'main' },
  'class-229': { door: [495, 182], branch: 'main' },
  'informatics-222': { door: [526, 182], branch: 'main' },
  'stairs-west-2': { door: [62, 360], branch: 'west' },
  'chemistry-biology-202': { door: [86, 263], branch: 'west' },
  'assistant-202': { door: [86, 355], branch: 'west' },
  'practical-225': { door: [86, 398], branch: 'west' },
  'electrical-lab-207': { door: [62, 450], branch: 'west' },
  'biotech-lab-225': { door: [86, 450], branch: 'west' },
}

export function pointInPolygon(point, polygon) {
  if (!point || !Array.isArray(polygon) || polygon.length < 3) return false
  const [x, y] = point
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    const cross = (x - xi) * (yj - yi) - (y - yi) * (xj - xi)
    if (Math.abs(cross) < 1e-6 && x >= Math.min(xi, xj) && x <= Math.max(xi, xj) && y >= Math.min(yi, yj) && y <= Math.max(yi, yj)) return true
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function roomAtPoint(floor, point, floorRooms) {
  return floorRooms.find((room) => room.floor === floor && pointInPolygon(point, roomOutline(room.id))) || null
}

export function isInsidePlan(floor, point, floorRooms) {
  const size = planSizes[floor]
  if (!size || !point || !point.every(Number.isFinite) || point[0] < 0 || point[1] < 0 || point[0] > size.width || point[1] > size.height) return false
  return Boolean(roomAtPoint(floor, point, floorRooms)) || circulation[floor].some((polygon) => pointInPolygon(point, polygon))
}

export function isManualPoint(value, floorRooms) {
  return value && (value.floor === 1 || value.floor === 2) && isInsidePlan(value.floor, [value.x, value.y], floorRooms)
}
