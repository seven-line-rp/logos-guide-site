// Coordinates are in the viewBox of the original floor SVGs. Keep these bounds,
// the clickable areas and the routing doorways in sync when changing the plan.
//
// Every box below is the centre line of the wall that is actually drawn on the
// plan (a stroked shape in the SVG straddles its own outline, so the hit area
// and the drawn wall line coincide). Fractional values are intentional: rounded
// boxes used to drift 1-3 px away from the drawing, and the middle staircase of
// the first floor even swallowed the shaft next to it. When the plan changes,
// take the new numbers from the SVG paths instead of eyeballing them.
export const planSizes = {
  1: { width: 758, height: 552 },
  2: { width: 767, height: 561 },
}

export const planRoomBounds = {
  canteen: [0.7, 0.7, 146.9, 154.4],
  'workshop-115': [147.7, 94.2, 109.6, 61.1],
  'simulator-114': [256, 93.5, 85, 62.5],
  'academic-office': [339.9, 93.5, 184.1, 62.5],
  'lift-1': [524, 93.5, 25, 62.5],
  'stairs-north-1': [549, 93, 60.7, 62.8],
  'auditorium-104': [609.7, 93, 147.4, 148.8],
  'class-119': [0, 179.5, 61.4, 72.6],
  'class-118': [0, 252.1, 61.4, 73.9],
  'toilet-men-1': [86, 178.9, 83.6, 32],
  'toilet-women-1': [86, 209.9, 83.6, 32],
  'language-148': [167.9, 179, 77.2, 62.8],
  'aerodynamics-120': [243.7, 179, 74.4, 62.8],
  // The central staircase on the first floor is three drawn cells: the landing
  // shaft at x=317.6…336.5 and the two flights at x=336.5…383.4. The whole block
  // is one clickable staircase; the director's office starts at x=383.4.
  'stairs-middle-1': [317.6, 179.7, 65.8, 61.4],
  'director-149': [383.4, 179.7, 66.3, 61.4],
  'changing-room': [448.8, 179, 99.9, 62.8],
  'hall-1': [548, 179, 62, 63],
  'entrance-1': [547.8, 239.5, 61.9, 24.2],
  'stairs-west-1': [0, 322, 62, 64],
  'class-139': [86, 306, 63.3, 69.8],
  'class-138': [86, 374.4, 63.3, 68.3],
  'class-162': [0, 419, 61.9, 50.2],
  'training-centre-113': [0, 467.8, 149.3, 84.2],

  'library-214': [0.7, 0.7, 143.8, 112.7],
  'radio-lab-228': [144.5, 95.5, 113.6, 61.3],
  'electro-radio-230': [258.1, 95.5, 98.5, 61.3],
  'assistant-230': [356.4, 94.8, 69.8, 62.7],
  'uav-lab-209': [422.6, 95.5, 112.2, 61.3],
  'lift-2': [534.6, 94.8, 26.4, 62.7],
  'stairs-north-2': [560.8, 95.5, 49, 61.3],
  'meteorology-236': [0.7, 181.7, 60.8, 98.6],
  'toilet-men-2': [87, 182.2, 60.8, 33.9],
  'toilet-women-2': [87, 213.8, 60.8, 31.1],
  'physics-211': [168.3, 181.5, 154.2, 64.1],
  'stairs-middle-2': [322.2, 182.2, 69.8, 62.7],
  'psychologist-224': [392.5, 182.2, 33, 62.7],
  'class-217': [425.5, 182.2, 54.2, 62.7],
  'class-229': [479.7, 182.2, 32, 62.7],
  'informatics-222': [511.7, 182.2, 49.5, 62.7],
  // The western staircase on the second floor starts below the grey shaft.
  'stairs-west-2': [0.7, 331.2, 60.8, 95.7],
  'chemistry-biology-202': [87, 244.2, 60.8, 83.8],
  'assistant-202': [87, 328, 60.8, 55.2],
  'practical-225': [87, 383.2, 60.8, 33.3],
  // Room 207 wraps around the corridor's lower end; room 225 is rectangular.
  'electrical-lab-207': [0, 417, 86, 143],
  'biotech-lab-225': [86, 417, 62, 143],
}

const irregularRooms = {
  'electrical-lab-207': [[0, 417], [62, 417], [62, 477], [86, 477], [86, 560], [0, 560]],
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
  'stairs-middle-1': { door: [359, 181], branch: 'main' },
  'director-149': { door: [416, 181], branch: 'main' },
  'changing-room': { door: [505, 181], branch: 'main' },
  'hall-1': { door: [579, 179], branch: 'hall' },
  'entrance-1': { door: [579, 241], branch: 'hall' },
  'stairs-west-1': { door: [62, 354], branch: 'west' },
  'class-139': { door: [86, 367], branch: 'west' },
  'class-138': { door: [86, 434], branch: 'west' },
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
