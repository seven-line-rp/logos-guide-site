import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import floorOnePlan from '../../map1lower.svg?raw'
import floorTwoPlan from '../../map2lower.svg?raw'
import { composePlanArt } from '../map-art.js'
import { buildRouteOptions } from '../map-routing.js'
import { planSizes, roomOutline } from '../map-geometry.js'
import { rooms } from '../data.js'
import { HERO_ROUTES, doorsOnRoute, floorDoors, floorWalls, openWalls, stairOffset, stairSteps, transferColumns } from '../hero-scene-model.js'
import '../hero-cine.css'

// Кино на первом экране: пять постановок одного и того же маршрута на WebGL.
// Корпус собирается из той же геометрии, что и карта (стены, двери, план),
// маршрут строит сам сайт. Отличаются свет, материал и работа камеры.
// Открываются по адресу /?hero=1 … /?hero=5; ?t=0.5 замораживает кадр.

const D2R = Math.PI / 180
const clamp = (v) => Math.max(0, Math.min(1, v))
const mix = (a, b, k) => a + (b - a) * k
const smooth = (k) => { const v = clamp(k); return v * v * (3 - 2 * v) }
const span = (t, a, b) => smooth((t - a) / (b - a))
const ease = (k) => { const v = clamp(k); return v < 0.5 ? 4 * v ** 3 : 1 - (-2 * v + 2) ** 3 / 2 }
const glide = (k) => mix(clamp(k), smooth(k), 0.6)
const hdr = (hex, gain = 1) => new THREE.Color(hex).multiplyScalar(gain)

const FOOTPRINT = {
  1: [[0.5, 93.5, 756.6, 148.3], [0, 92.5, 147, 458]],
  2: [[0.5, 94.8, 766.5, 150.4], [0.5, 94.8, 148, 463.4]],
}
const CENTER = new THREE.Vector3(372, 0, 236)
const columns = transferColumns()
const roomById = (id) => rooms.find((room) => room.id === id)
const bounds = (points) => { const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] }

// ---------- Геометрия ----------
function boxes(items) {
  const parts = items.filter((item) => item.len > 0.5).map((item) => {
    const geometry = new THREE.BoxGeometry(item.len + item.thick, item.h, item.thick)
    geometry.translate(item.len / 2, item.h / 2 + (item.y || 0), 0)
    geometry.rotateY(-item.angle * D2R)
    geometry.translate(item.x, 0, item.z)
    return geometry
  })
  return parts.length ? mergeGeometries(parts) : new THREE.BufferGeometry()
}
function slabs(rects, y, thick) {
  return mergeGeometries(rects.map(([x, z, w, d]) => new THREE.BoxGeometry(w, thick, d).translate(x + w / 2, y - thick / 2, z + d / 2)))
}
function wallLines(walls, h, full) {
  const points = []
  for (const wall of walls) {
    const a = wall.angle * D2R
    const x2 = wall.x + Math.cos(a) * wall.length
    const z2 = wall.y + Math.sin(a) * wall.length
    points.push(wall.x, h, wall.y, x2, h, z2)
    if (full) points.push(wall.x, 0, wall.y, x2, 0, z2, wall.x, 0, wall.y, wall.x, h, wall.y)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  return geometry
}
function roomShape(id, y) {
  const outline = roomOutline(id)
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)))
  return new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2).translate(0, y, 0)
}

// Скруглённые углы пути: точка идёт по дуге, а не ломается под 90°.
function fillet(points, y, radius = 9) {
  const out = []
  points.forEach(([x, z], index) => {
    const prev = points[index - 1]
    const next = points[index + 1]
    if (!prev || !next) { out.push(new THREE.Vector3(x, y, z)); return }
    const a = new THREE.Vector2(prev[0] - x, prev[1] - z)
    const b = new THREE.Vector2(next[0] - x, next[1] - z)
    const r = Math.min(radius, a.length() / 2, b.length() / 2)
    a.setLength(r)
    b.setLength(r)
    for (let step = 0; step <= 6; step += 1) {
      const k = step / 6
      const px = (1 - k) ** 2 * (x + a.x) + 2 * (1 - k) * k * x + k ** 2 * (x + b.x)
      const pz = (1 - k) ** 2 * (z + a.y) + 2 * (1 - k) * k * z + k ** 2 * (z + b.y)
      out.push(new THREE.Vector3(px, y, pz))
    }
  })
  return out
}
function densify(points, stepSize = 5) {
  const out = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    const count = Math.max(1, Math.ceil(from.distanceTo(to) / stepSize))
    for (let step = 1; step <= count; step += 1) out.push(from.clone().lerp(to, step / count))
  }
  return out
}
const lengthOf = (points) => points.reduce((sum, point, index) => (index ? sum + point.distanceTo(points[index - 1]) : 0), 0)

// ---------- Подписи и план как текстуры ----------
function labelSprite(text, { color = '#ffffff', background = 'rgba(8,20,58,.86)', size = 9 } = {}) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  const font = '700 56px "Onest Variable", Onest, system-ui, sans-serif'
  context.font = font
  const width = Math.ceil(context.measureText(text).width) + 56
  canvas.width = width
  canvas.height = 96
  context.font = font
  context.fillStyle = background
  context.beginPath()
  context.roundRect(0, 0, width, 96, 26)
  context.fill()
  context.fillStyle = color
  context.textBaseline = 'middle'
  context.fillText(text, 28, 51)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }))
  sprite.scale.set(size * width / 96, size, 1)
  return sprite
}

const planCache = new Map()
function planTexture(floor, palette) {
  const key = `${floor}:${JSON.stringify(palette)}`
  if (planCache.has(key)) return planCache.get(key)
  const { width, height } = planSizes[floor]
  const canvas = document.createElement('canvas')
  canvas.width = width * 3
  canvas.height = height * 3
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  const style = `<style>
    svg > [fill='#D9D9D9'] { fill: transparent; stroke: none }
    svg > [fill='white'] { fill: ${palette.corridor}; stroke: none }
    svg > [fill='#DFE6FF'] { fill: ${palette.room} }
    svg > [fill='#878DA2'] { fill: ${palette.room} }
    svg > [stroke='#ACAEB3'] { stroke: ${palette.wall} }
    svg > path[fill='#ACAEB3'] { fill: ${palette.wall} }
    svg > path[fill='black'] { fill: ${palette.label}; opacity: 1 }
    .plan-art-text { fill: ${palette.label}; font-family: system-ui, sans-serif; font-weight: 600 }
    [fill='#0000FF'], path[fill^='url('] { fill: ${palette.icon || palette.label} }
    g path[stroke='#0000FF'] { stroke: ${palette.icon || palette.label} }
    svg > rect[height='2'] { fill: transparent }
  </style>`
  const svg = composePlanArt(floor === 1 ? floorOnePlan : floorTwoPlan, floor, 'ru').replace(/<svg([^>]*)>/, (match) => `${match}${style}`)
  const image = new Image()
  image.onload = () => { canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); texture.needsUpdate = true }
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  planCache.set(key, texture)
  return texture
}

// ---------- Маршруты ----------
const routes = HERO_ROUTES.map((route) => {
  const option = buildRouteOptions(route.from, route.to).find((item) => item.kind === route.via)
  const lower = option?.byFloor[1]?.points || []
  const upper = option?.byFloor[2]?.points || []
  if (lower.length < 2 || upper.length < 2) return null
  const column = columns.find((item) => item.id === `${route.via}-1`)
  return { ...route, lower, upper, lift: route.via === 'lift' ? [column.x, column.y] : null }
}).filter(Boolean)

// ---------- Сцена одного маршрута ----------
function buildStage(V, route) {
  const group = new THREE.Group()
  const trash = []
  const keep = (item) => { trash.push(item); return item }
  const gap = V.gap
  const H = V.wallH
  const oz = V.upperZ || 0

  const floors = [1, 2].map((floor, index) => {
    const holder = new THREE.Group()
    const path = index === 0 ? route.lower : route.upper
    const allDoors = floorDoors(floor)
    const opened = doorsOnRoute(allDoors, path)
    const walls = openWalls(floorWalls(floor), path)
    const doors = allDoors.filter((door) => !opened.has(door.id))
    const roomRects = rooms.filter((room) => room.floor === floor).map((room) => { const [x1, z1, x2, z2] = bounds(roomOutline(room.id)); return [x1, z1, x2 - x1, z2 - z1] })
    const rects = [...FOOTPRINT[floor], ...roomRects]
    const materials = []
    const slab = new THREE.Mesh(keep(slabs(rects, 0, 3)), keep(V.slab()))
    materials.push(slab.material)
    holder.add(slab)
    slab.receiveShadow = true
    slab.castShadow = !!V.slabShadow

    if (V.plan) {
      const { width, height } = planSizes[floor]
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(width, height).rotateX(-Math.PI / 2).translate(width / 2, 0.15, height / 2), new THREE.MeshBasicMaterial({ map: planTexture(floor, V.plan), transparent: true, depthWrite: false, opacity: V.plan.opacity ?? 1, toneMapped: false }))
      sheet.material.userData.base = sheet.material.opacity
      materials.push(sheet.material)
      keep(sheet.geometry)
      keep(sheet.material)
      holder.add(sheet)
    }

    const rise = new THREE.Group()
    holder.add(rise)
    if (V.solid !== false) {
      const wallMesh = new THREE.Mesh(boxes(walls.map((wall) => ({ x: wall.x, z: wall.y, len: wall.length, angle: wall.angle, h: H, thick: V.wallThick || 1.8 }))), V.wall())
      wallMesh.castShadow = true
      wallMesh.receiveShadow = true
      materials.push(wallMesh.material)
      keep(wallMesh.geometry)
      keep(wallMesh.material)
      rise.add(wallMesh)
    }
    if (V.edge) {
      const lines = new THREE.LineSegments(wallLines(walls, H + 0.05, V.solid === false), new THREE.LineBasicMaterial({ color: V.edge.color, transparent: true, opacity: V.edge.opacity, blending: V.edge.additive ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false }))
      lines.material.userData.base = V.edge.opacity
      materials.push(lines.material)
      keep(lines.geometry)
      keep(lines.material)
      rise.add(lines)
    }
    if (V.door) {
      const doorMesh = new THREE.Mesh(boxes(doors.map((door) => ({ x: door.x, z: door.y, len: door.width, angle: door.angle, h: H * 0.8, thick: 2.6 }))), V.door())
      materials.push(doorMesh.material)
      keep(doorMesh.geometry)
      keep(doorMesh.material)
      rise.add(doorMesh)
    }
    if (V.interior) {
      const ceiling = new THREE.Mesh(slabs(rects, H + 2.5, 2.5), new THREE.MeshStandardMaterial({ color: '#0b1230', roughness: 1 }))
      keep(ceiling.geometry)
      keep(ceiling.material)
      holder.add(ceiling)
      // Светильники на потолке вдоль пути: дают глубину коридору.
      const lamps = []
      for (let step = 1; step < path.length; step += 1) {
        const [ax, az] = path[step - 1]
        const [bx, bz] = path[step]
        const length = Math.hypot(bx - ax, bz - az)
        const angle = Math.atan2(bz - az, bx - ax) / D2R
        for (let d = 18; d < length - 8; d += 34) lamps.push({ x: ax + (bx - ax) * d / length, z: az + (bz - az) * d / length, len: 13, angle, h: 0.4, thick: 3.2, y: H - 0.5 })
      }
      const lampMesh = new THREE.Mesh(boxes(lamps), new THREE.MeshBasicMaterial({ color: hdr('#dce6ff', 2.4) }))
      keep(lampMesh.geometry)
      keep(lampMesh.material)
      holder.add(lampMesh)
      // Таблички с номерами у дверей вдоль пути.
      for (const door of allDoors) {
        const cx = door.x + Math.cos(door.angle * D2R) * door.width / 2
        const cz = door.y + Math.sin(door.angle * D2R) * door.width / 2
        let best = null
        for (let step = 1; step < path.length; step += 1) {
          const [ax, az] = path[step - 1]
          const [bx, bz] = path[step]
          const length2 = (bx - ax) ** 2 + (bz - az) ** 2 || 1
          const k = clamp(((cx - ax) * (bx - ax) + (cz - az) * (bz - az)) / length2)
          const px = ax + (bx - ax) * k
          const pz = az + (bz - az) * k
          const distance = Math.hypot(px - cx, pz - cz)
          if (!best || distance < best.distance) best = { distance, px, pz }
        }
        if (!best || best.distance > 26 || best.distance < 1) continue
        const room = roomById(door.id)
        const text = (room.number || '').split(',')[0].trim() || room.name
        if (text.length > 16 || door.id === route.to) continue
        const sprite = labelSprite(text, { size: 3.4, background: 'rgba(250,252,255,.94)', color: '#10265e' })
        sprite.position.set(cx + (best.px - cx) / best.distance * 2.4, H * 0.86, cz + (best.pz - cz) / best.distance * 2.4)
        sprite.material.fog = true
        keep(sprite.material.map)
        keep(sprite.material)
        holder.add(sprite)
      }
    }
    holder.position.y = index ? gap : 0
    holder.position.z = index ? oz : 0
    group.add(holder)
    let transparentNow = null
    const setAlpha = (alpha) => {
      holder.visible = alpha > 0.01
      const transparent = alpha < 0.995
      for (const material of materials) {
        const base = material.userData.base
        if (base !== undefined) { material.opacity = base * alpha; continue }
        material.opacity = alpha
        if (transparent !== transparentNow) { material.transparent = transparent; material.depthWrite = !transparent || alpha > 0.5; material.needsUpdate = true }
      }
      transparentNow = transparent
    }
    return { holder, rise, setAlpha }
  })

  // Путь: первый этаж → подъём → второй этаж.
  const lift = V.interior ? 0.9 : H * 0.6
  const lowerPoints = fillet(route.lower, lift)
  const upperPoints = fillet(route.upper.map(([x, z]) => [x, z + oz]), gap + lift)
  const a = route.lower.at(-1)
  const b = [route.upper[0][0], route.upper[0][1] + oz]
  const climbPoints = []
  if (route.lift) {
    const [cx, cz] = route.lift
    climbPoints.push(new THREE.Vector3(cx, lift, cz), new THREE.Vector3(cx, gap + lift, cz + oz))
  } else if (V.interior) {
    for (let step = 1; step < 10; step += 1) { const k = step / 10; climbPoints.push(new THREE.Vector3(mix(a[0], b[0], k), lift + gap * smooth(k), mix(a[1], b[1], k))) }
  } else {
    for (let step = 1; step < 44; step += 1) { const k = step / 44; const [dx, dz] = stairOffset(k); climbPoints.push(new THREE.Vector3(mix(a[0], b[0], k) + dx, lift + gap * k, mix(a[1], b[1], k) + dz)) }
  }
  const all = densify([...lowerPoints, ...climbPoints, ...upperPoints])
  const total = lengthOf(all)
  const uA = lengthOf(lowerPoints) / total
  const uB = 1 - lengthOf(upperPoints) / total
  const curve = new THREE.CatmullRomCurve3(all, false, 'centripetal')
  curve.arcLengthDivisions = 1200
  const SEGMENTS = 900
  const RADIAL = 8
  const tube = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, SEGMENTS, V.route.radius, RADIAL, false)), keep(new THREE.MeshBasicMaterial({ color: V.route.color })))
  const ghost = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, SEGMENTS, V.route.radius * 0.36, 6, false)), keep(new THREE.MeshBasicMaterial({ color: V.route.ghost, transparent: true, opacity: V.route.ghostOpacity ?? 0.5 })))
  group.add(tube, ghost)
  const setDrawn = (u) => tube.geometry.setDrawRange(0, Math.floor(clamp(u) * SEGMENTS) * RADIAL * 6)

  let stepsMesh = null
  if (!route.lift && !V.interior && V.steps) {
    const stepMesh = new THREE.Mesh(boxes(stairSteps(a, b).map((step) => ({ x: step.x - Math.cos(step.angle * D2R) * 3, z: step.y - Math.sin(step.angle * D2R) * 3, len: 6, angle: step.angle, h: 0.9, thick: 11, y: step.k * gap - 0.6 }))), V.steps())
    keep(stepMesh.geometry)
    keep(stepMesh.material)
    stepMesh.castShadow = true
    group.add(stepMesh)
    stepsMesh = stepMesh
  }

  // Тот, кто идёт: светящаяся точка, которая освещает стены вокруг себя.
  const walker = new THREE.Group()
  const dot = new THREE.Mesh(keep(new THREE.SphereGeometry(V.route.radius * 1.9, 20, 14)), keep(new THREE.MeshBasicMaterial({ color: V.route.head || V.route.color })))
  walker.add(dot)
  const lamp = new THREE.PointLight(V.route.light, V.route.lamp, V.route.reach || 170, 1.7)
  lamp.position.y = 7
  walker.add(lamp)
  group.add(walker)

  // Цель: комната загорается, над ней подпись.
  const target = roomById(route.to)
  const [x1, z1, x2, z2] = bounds(roomOutline(route.to))
  const local = new THREE.Vector3((x1 + x2) / 2, 0, (z1 + z2) / 2)
  const targetCenter = new THREE.Vector3(local.x, gap, local.z + oz)
  const glow = new THREE.Mesh(keep(roomShape(route.to, 0.5)), keep(new THREE.MeshBasicMaterial({ color: V.route.color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })))
  const roomLamp = new THREE.PointLight(V.route.light, 0, 150, 1.6)
  roomLamp.position.set(local.x, H * 0.8, local.z)
  const label = labelSprite(target.number && target.number.length < 5 ? `${target.name} · ${target.number}` : target.name, V.label)
  if (V.interior) { label.position.set(route.upper.at(-1)[0], H * 0.8, route.upper.at(-1)[1]); label.material.depthTest = false } else label.position.set(local.x, H + (V.label?.lift ?? 16), local.z)
  label.material.opacity = 0
  keep(label.material.map)
  keep(label.material)
  floors[1].holder.add(glow, roomLamp, label)
  const setArrival = (k, shown = 1) => {
    glow.material.opacity = (V.route.roomGlow ?? 0.5) * (0.16 * shown + 0.84 * k)
    roomLamp.intensity = (V.route.roomLamp ?? V.route.lamp) * (0.08 * shown + 0.92 * k)
    if (stepsMesh) stepsMesh.visible = shown > 0.03
    label.material.opacity = k
  }

  return { group, floors, curve, total, uA, uB, walker, lamp, setDrawn, setArrival, targetCenter, gap, dispose: () => trash.forEach((item) => item.dispose?.()) }
}

// Где точка на пути в момент t: этаж, подъём, этаж — каждому своя доля времени.
function travel(t, stage, T) {
  if (t < T.c0) return stage.uA * glide((t - T.s) / (T.c0 - T.s))
  if (t < T.c1) return mix(stage.uA, stage.uB, smooth((t - T.c0) / (T.c1 - T.c0)))
  return mix(stage.uB, 1, glide((t - T.c1) / (T.e - T.c1)))
}
const _p = new THREE.Vector3()
const _look = new THREE.Vector3()
function orbit(camera, look, radius, azimuth, elevation) {
  const az = azimuth * D2R
  const el = elevation * D2R
  camera.position.set(look.x + radius * Math.sin(az) * Math.cos(el), look.y + radius * Math.sin(el), look.z + radius * Math.cos(az) * Math.cos(el))
  camera.lookAt(look)
}
// Общая часть постановки: точка едет по пути, второй этаж проявляется на подъёме.
function act(t, stage, T, { hideUpper = true } = {}) {
  const u = travel(clamp(t), stage, T)
  stage.curve.getPointAt(clamp(u), _p)
  stage.walker.position.copy(_p)
  stage.walker.visible = t > T.s - 0.02 && t < T.e + 0.05
  stage.setDrawn(u)
  const climb = span(t, T.c0 - 0.03, T.c1)
  if (hideUpper) stage.floors[1].setAlpha(climb)
  stage.setArrival(span(t, T.e - 0.1, T.e + 0.02), climb)
  return { u, climb, point: _p }
}

// ---------- Пять постановок ----------
const GOLD = '#ffcf5a'
const VARIANTS = {
  // 1. Ночной корпус: тёмный макет, идущий несёт свет, кабинет ждёт с зажжённой лампой.
  1: {
    name: 'night', seconds: 20, fov: 32, gap: 120, wallH: 9, exposure: 1.15, shadows: true,
    bloom: [0.85, 0.7, 0.9], shade: '#050a1c',
    background: (scene) => { scene.background = new THREE.Color('#050a1c'); scene.fog = new THREE.FogExp2('#050a1c', 0.00075) },
    slab: () => new THREE.MeshStandardMaterial({ color: '#0d1838', roughness: 0.7, metalness: 0.1 }),
    wall: () => new THREE.MeshStandardMaterial({ color: '#4a66c4', roughness: 0.8 }),
    door: () => new THREE.MeshBasicMaterial({ color: hdr('#5f86ff', 0.8) }),
    steps: () => new THREE.MeshBasicMaterial({ color: hdr(GOLD, 0.7) }),
    edge: { color: '#86a6ff', opacity: 0.55 },
    plan: { room: 'rgba(120,150,255,.05)', corridor: 'rgba(255,255,255,.03)', wall: 'transparent', label: 'rgba(170,195,255,.5)', opacity: 0.9 },
    route: { color: hdr(GOLD, 3.2), ghost: '#6d7fb8', radius: 1.5, light: '#ffb655', lamp: 2600, roomGlow: 0.55 },
    label: { size: 15, lift: 20 },
    lights: (scene) => {
      scene.add(new THREE.HemisphereLight('#5b79e0', '#03050d', 0.9))
      const moon = new THREE.DirectionalLight('#9bb6ff', 2.6)
      moon.position.set(120, 620, 520)
      moon.target.position.copy(CENTER)
      shadowFor(moon)
      scene.add(moon, moon.target)
    },
    direct: (t, stage, camera) => {
      const T = { s: 0.07, c0: 0.42, c1: 0.55, e: 0.88 }
      const { point, climb } = act(t, stage, T)
      const k = ease(span(t, 0.02, 0.92))
      _look.copy(CENTER).lerp(point, 0.25 + 0.4 * k)
      _look.y = mix(0, stage.gap * 0.7, climb)
      orbit(camera, _look, mix(920, 610, k), mix(-22, 16, k), mix(54, 36, k))
    },
  },
  // 2. Макет на столе: белая модель под низким солнцем, резкость только на идущем.
  2: {
    name: 'model', seconds: 20, fov: 26, upperZ: -190, gap: 150, wallH: 10, exposure: 1, shadows: true, slabShadow: true,
    bokeh: { aperture: 0.000011, maxblur: 0.0045 }, shade: '#0c2462',
    background: (scene) => { scene.background = gradient('#16379a', '#0a1f5c'); scene.fog = new THREE.Fog('#12318c', 900, 2600) },
    slab: () => new THREE.MeshStandardMaterial({ color: '#d5def8', roughness: 0.9 }),
    wall: () => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.75 }),
    door: () => new THREE.MeshStandardMaterial({ color: '#3d6bf2', roughness: 0.5 }),
    steps: () => new THREE.MeshStandardMaterial({ color: '#ffc234', roughness: 0.5 }),
    plan: { room: 'rgba(255,255,255,.5)', corridor: 'rgba(120,150,230,.16)', wall: 'transparent', label: 'rgba(40,70,160,.55)', opacity: 1 },
    route: { color: hdr('#ff9500', 1.7), ghost: '#e9a53a', ghostOpacity: 0.4, radius: 2.3, light: '#ffcc66', lamp: 500, roomGlow: 0.75, head: hdr('#ff9a00', 1.3) },
    label: { size: 15, lift: 18, background: 'rgba(255,255,255,.96)', color: '#0d2a6b' },
    lights: (scene) => {
      scene.add(new THREE.HemisphereLight('#bcd0ff', '#2a47a8', 0.6))
      const sun = new THREE.DirectionalLight('#fff0d2', 3.6)
      sun.position.set(-420, 300, 380)
      sun.target.position.copy(CENTER)
      shadowFor(sun, 3)
      scene.add(sun, sun.target)
      const table = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000).rotateX(-Math.PI / 2).translate(380, -3.2, 280), new THREE.ShadowMaterial({ color: '#030b2c', opacity: 0.42 }))
      table.receiveShadow = true
      scene.add(table)
    },
    direct: (t, stage, camera, post) => {
      const T = { s: 0.2, c0: 0.5, c1: 0.62, e: 0.9 }
      const { point } = act(t, stage, T, { hideUpper: false })
      // Второй этаж снимается, как крышка: сначала корпус собран, потом раскрыт.
      const open = ease(span(t, 0.03, 0.2))
      stage.floors[1].holder.position.y = mix(13, stage.gap, open)
      stage.floors[1].holder.position.z = -190 * open
      stage.floors[1].setAlpha(1)
      const k = span(t, 0, 1)
      _look.copy(CENTER).lerp(point, 0.3)
      _look.y = mix(10, stage.gap * 0.5, open)
      _look.z -= 70 * open
      orbit(camera, _look, mix(1120, 1040, ease(k)), mix(22, -22, k), mix(48, 40, open))
      if (post.bokeh) post.bokeh.uniforms.focus.value = camera.position.distanceTo(t < T.s ? _look : point)
    },
  },
  // 3. Голограмма: корпус из света, маршрут прожигает его насквозь.
  3: {
    name: 'holo', seconds: 20, fov: 30, gap: 110, wallH: 10, exposure: 1, solid: false,
    bloom: [0.8, 0.8, 0.35], shade: '#02040e',
    background: (scene) => { scene.background = new THREE.Color('#02040e'); scene.fog = new THREE.FogExp2('#02040e', 0.00085) },
    slab: () => new THREE.MeshBasicMaterial({ color: '#16379c', transparent: true, opacity: 0.2, depthWrite: false, userData: { base: 0.2 } }),
    door: () => new THREE.MeshBasicMaterial({ color: hdr('#59d0ff', 0.7) }),
    steps: () => new THREE.MeshBasicMaterial({ color: hdr(GOLD, 1.2) }),
    edge: { color: hdr('#3f7dff', 1.5), opacity: 0.8, additive: true },
    plan: { room: 'rgba(70,120,255,.1)', corridor: 'transparent', wall: 'transparent', label: 'rgba(140,190,255,.75)', opacity: 0.9 },
    route: { color: hdr(GOLD, 2.3), ghost: '#35549e', radius: 1.35, light: '#ffb655', lamp: 0, roomGlow: 0.6 },
    label: { size: 14, lift: 18, background: 'rgba(4,10,30,.82)', color: '#ffe3a1' },
    lights: (scene) => {
      const grid = new THREE.GridHelper(2400, 80, '#1b3fae', '#0d2163')
      grid.position.set(380, -4, 260)
      grid.material.transparent = true
      grid.material.opacity = 0.55
      scene.add(grid)
      const count = 500
      const positions = new Float32Array(count * 3)
      for (let index = 0; index < count; index += 1) { positions[index * 3] = Math.random() * 1100 - 170; positions[index * 3 + 1] = Math.random() * 330 - 20; positions[index * 3 + 2] = Math.random() * 900 - 150 }
      const dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(positions, 3)), new THREE.PointsMaterial({ color: hdr('#7fb0ff', 1.6), size: 2.2, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }))
      scene.add(dust)
      return (t) => { dust.position.y = (t * 60) % 40 }
    },
    direct: (t, stage, camera) => {
      const T = { s: 0.06, c0: 0.42, c1: 0.56, e: 0.9 }
      const { point } = act(t, stage, T, { hideUpper: false })
      stage.floors[1].setAlpha(mix(0.3, 1, span(t, T.c0 - 0.05, T.c1)))
      stage.floors[0].setAlpha(mix(1, 0.45, span(t, T.c1 - 0.05, T.c1 + 0.08)))
      _look.copy(CENTER).lerp(point, 0.35)
      _look.y = mix(20, 70, span(t, 0.3, 0.6))
      orbit(camera, _look, mix(880, 640, ease(span(t, 0, 0.8))), mix(-38, 30, t), mix(27, 21, t))
    },
  },
  // 4. От первого лица: камера идёт по коридору на уровне глаз до самой двери.
  4: {
    name: 'walk', seconds: 24, fov: 64, gap: 30, wallH: 24, wallThick: 2.2, exposure: 1.1, interior: true, shift: 0.1,
    bloom: [0.7, 0.6, 0.85], shade: '#070c22',
    background: (scene) => { scene.background = new THREE.Color('#070c22'); scene.fog = new THREE.FogExp2('#070c22', 0.0058) },
    slab: () => new THREE.MeshStandardMaterial({ color: '#1b2a63', roughness: 0.32, metalness: 0.25 }),
    wall: () => new THREE.MeshStandardMaterial({ color: '#b9c6ee', roughness: 0.78 }),
    door: () => new THREE.MeshStandardMaterial({ color: '#2f55cf', roughness: 0.45, emissive: '#16308c', emissiveIntensity: 0.5 }),
    route: { color: hdr(GOLD, 2.6), ghost: hdr(GOLD, 2.2), ghostOpacity: 1, radius: 0.5, light: '#ffe3b0', lamp: 150, reach: 330, roomGlow: 0.3, roomLamp: 70 },
    label: { size: 4.4, background: 'rgba(255,207,90,.97)', color: '#1d1503' },
    lights: (scene) => { scene.add(new THREE.HemisphereLight('#8ea6ee', '#0a1030', 0.5), new THREE.AmbientLight('#b4c2f5', 0.5)) },
    direct: (t, stage, camera, post, root) => {
      const T = { s: 0.03, c0: 0.44, c1: 0.52, e: 0.9 }
      const stop = 1 - 40 / stage.total
      const u = Math.min(stop, travel(clamp(t), stage, T))
      stage.setDrawn(0)
      stage.floors[1].setAlpha(1)
      stage.walker.visible = false
      stage.setArrival(span(t, 0.6, 0.86))
      stage.curve.getPointAt(clamp(u), camera.position)
      const eye = 12.5 + Math.sin(u * stage.total * 0.33) * 0.2
      camera.position.y += eye
      stage.curve.getPointAt(Math.min(1, u + 46 / stage.total), _look)
      _look.y += eye - 2.5
      const arrive = span(t, 0.8, 0.94)
      stage.curve.getPointAt(1, _p)
      _p.y += eye - 1
      _look.lerp(_p, arrive)
      camera.lookAt(_look)
      // Фонарь идёт чуть впереди камеры.
      stage.lamp.parent.visible = true
      stage.lamp.parent.position.copy(camera.position).lerp(_look, 0.25)
      stage.lamp.position.y = 6
      stage.lamp.parent.children[0].visible = false
      // Лестница — склейка: затемнение с титром «2 этаж».
      const cut = Math.sin(Math.PI * clamp((t - (T.c0 - 0.025)) / (T.c1 - T.c0 + 0.05))) ** 0.6 || 0
      root.style.setProperty('--cut', (t > T.c0 - 0.025 && t < T.c1 + 0.025 ? cut : 0).toFixed(3))
    },
  },
  // 5. Из чертежа: вид сверху на план, стены вырастают, камера уходит в облёт.
  5: {
    name: 'blueprint', seconds: 22, fov: 30, gap: 130, wallH: 9, exposure: 1.05, shadows: true,
    bloom: [0.45, 0.6, 0.92], shade: '#0b2a80',
    background: (scene) => { scene.background = gradient('#1746c2', '#0a2676'); scene.fog = new THREE.Fog('#123aa8', 1000, 2800) },
    slab: () => new THREE.MeshStandardMaterial({ color: '#1238a8', roughness: 0.95 }),
    wall: () => new THREE.MeshStandardMaterial({ color: '#f4f7ff', roughness: 0.6 }),
    door: () => new THREE.MeshBasicMaterial({ color: hdr(GOLD, 1.1) }),
    steps: () => new THREE.MeshBasicMaterial({ color: hdr(GOLD, 1.1) }),
    edge: { color: '#ffffff', opacity: 0.95 },
    plan: { room: 'rgba(255,255,255,.07)', corridor: 'rgba(255,255,255,.02)', wall: 'rgba(255,255,255,.9)', label: 'rgba(255,255,255,.9)', opacity: 1 },
    route: { color: hdr('#ffb300', 2.6), ghost: '#ffffff', ghostOpacity: 0.3, radius: 2.4, light: '#ffcf80', lamp: 1500, roomGlow: 0.7 },
    label: { size: 15, lift: 18, background: 'rgba(255,255,255,.97)', color: '#0d2a6b' },
    lights: (scene) => {
      scene.add(new THREE.HemisphereLight('#cfdcff', '#1a3fae', 1.5))
      const sun = new THREE.DirectionalLight('#ffffff', 2.2)
      sun.position.set(-200, 520, 460)
      sun.target.position.copy(CENTER)
      shadowFor(sun, 2)
      scene.add(sun, sun.target)
      const paper = new THREE.GridHelper(4000, 100, '#3f6ee6', '#2a56d2')
      paper.position.set(380, -3.4, 260)
      paper.material.transparent = true
      paper.material.opacity = 0.6
      scene.add(paper)
    },
    direct: (t, stage, camera) => {
      const T = { s: 0.3, c0: 0.56, c1: 0.67, e: 0.91 }
      const { point, climb } = act(t, stage, T)
      const grow = ease(span(t, 0.1, 0.3))
      stage.floors[0].rise.scale.y = Math.max(0.001, grow)
      stage.floors[1].rise.scale.y = Math.max(0.001, ease(span(t, T.c0 - 0.02, T.c1)))
      const tilt = ease(span(t, 0.08, 0.34))
      _look.copy(CENTER).lerp(point, 0.3 * tilt)
      _look.y = mix(0, stage.gap * 0.6, climb)
      orbit(camera, _look, mix(1180, 860, ease(span(t, 0.08, 0.6))), mix(0, -30, ease(span(t, 0.1, 0.5))) + 44 * span(t, 0.5, 1), mix(88.5, 36, tilt))
    },
  },
}

function shadowFor(light, radius = 4) {
  light.castShadow = true
  light.shadow.mapSize.set(2048, 2048)
  Object.assign(light.shadow.camera, { left: -620, right: 620, top: 520, bottom: -520, near: 10, far: 2200 })
  light.shadow.bias = -0.0006
  light.shadow.normalBias = 1.2
  light.shadow.radius = radius
}
function gradient(top, bottom) {
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 256
  const context = canvas.getContext('2d')
  const fill = context.createLinearGradient(0, 0, 0, 256)
  fill.addColorStop(0, top)
  fill.addColorStop(1, bottom)
  context.fillStyle = fill
  context.fillRect(0, 0, 4, 256)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function mount(root, V) {
  const params = new URLSearchParams(window.location.search)
  const frozen = params.has('t') ? Number(params.get('t')) : window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.8 : null
  const canvas = root.querySelector('canvas')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = V.exposure
  renderer.shadowMap.enabled = !!V.shadows
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const scene = new THREE.Scene()
  V.background(scene)
  const tickExtra = V.lights(scene)
  const camera = new THREE.PerspectiveCamera(V.fov, 1, V.interior ? 0.5 : 20, 5000)
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))
  const post = {}
  if (V.bokeh) { post.bokeh = new BokehPass(scene, camera, { focus: 800, ...V.bokeh }); composer.addPass(post.bokeh) }
  if (V.bloom) { post.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), ...V.bloom); composer.addPass(post.bloom) }
  composer.addPass(new OutputPass())

  let index = Number(params.get('route')) || 0
  let stage = null
  const setRoute = () => {
    if (stage) { scene.remove(stage.group); stage.dispose() }
    const route = routes[index % routes.length]
    stage = buildStage(V, route)
    scene.add(stage.group)
    window.dispatchEvent(new CustomEvent('hero-route', { detail: { from: route.from, to: route.to, via: route.via } }))
  }
  setRoute()

  // Сцена смещена вправо: слева на первом экране стоит текст. На узком — вверх.
  const resize = () => {
    const width = root.clientWidth || 1
    const height = root.clientHeight || 1
    renderer.setSize(width, height, false)
    composer.setSize(width, height)
    camera.aspect = width / height
    const shift = V.shift ?? 0.17
    if (width < 860) camera.setViewOffset(width, height, 0, height * 0.16, width, height)
    else camera.setViewOffset(width, height, -width * shift, 0, width, height)
    camera.updateProjectionMatrix()
  }
  const sizeObserver = new ResizeObserver(resize)
  sizeObserver.observe(root)
  resize()

  const draw = (t) => {
    V.direct(t, stage, camera, post, root)
    tickExtra?.(t)
    root.style.setProperty('--fade', (span(t, 0, 0.035) * (1 - span(t, 0.965, 1))).toFixed(3))
    composer.render()
  }
  let frameId = 0
  let startedAt = performance.now()
  let pausedAt = 0
  let inView = true
  const tick = (now) => {
    const t = (now - startedAt) / 1000 / V.seconds
    if (t >= 1) { index += 1; setRoute(); startedAt = now; draw(0) } else draw(t)
    frameId = requestAnimationFrame(tick)
  }
  if (params.has('step')) window.__heroCine = { draw, seconds: V.seconds }
  else if (frozen !== null) {
    // Текстуры плана грузятся не мгновенно: перерисовываем неподвижный кадр несколько раз.
    let left = 12
    const still = () => { draw(frozen); left -= 1; if (left > 0) frameId = window.setTimeout(still, 150) }
    still()
  } else frameId = requestAnimationFrame(tick)
  const sync = () => {
    if (frozen !== null || params.has('step')) return
    const run = inView && !document.hidden
    if (run && pausedAt) { startedAt += performance.now() - pausedAt; pausedAt = 0; frameId = requestAnimationFrame(tick) } else if (!run && !pausedAt) { pausedAt = performance.now(); cancelAnimationFrame(frameId) }
  }
  const viewObserver = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; sync() })
  viewObserver.observe(root)
  document.addEventListener('visibilitychange', sync)
  return () => {
    cancelAnimationFrame(frameId)
    window.clearTimeout(frameId)
    sizeObserver.disconnect()
    viewObserver.disconnect()
    document.removeEventListener('visibilitychange', sync)
    stage?.dispose()
    composer.dispose()
    renderer.dispose()
  }
}

export default function HeroCine({ variant }) {
  const rootRef = useRef(null)
  const V = VARIANTS[variant] || VARIANTS[1]
  useEffect(() => mount(rootRef.current, V), [V])
  return <div className={`hero-cine hero-cine-${V.name}`} ref={rootRef} aria-hidden="true" style={{ '--shade': V.shade }}>
    <canvas />
    <div className="hero-cine-cut"><b>2 этаж</b></div>
  </div>
}
