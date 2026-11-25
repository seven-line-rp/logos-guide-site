import * as T from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

export function ease(a, b, p) {
  const t = Math.max(0, Math.min(1, (p - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function engravedFace() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1024
  const ctx = canvas.getContext('2d')
  ctx.translate(512, 512)
  ctx.fillStyle = '#1d2229'
  ctx.fillRect(-512, -512, 1024, 1024)
  for (const r of [488, 408, 317, 312, 108]) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, 2 * Math.PI)
    ctx.strokeStyle = '#56616e'
    ctx.stroke()
  }
  for (let i = 0; i < 360; i += 2) {
    ctx.save()
    ctx.rotate((i * Math.PI) / 180)
    const major = i % 10 === 0
    ctx.fillStyle = major ? '#e7edf4' : '#9da9b6'
    ctx.fillRect(-1.5, -480, major ? 3 : 2, major ? 25 : 12)
    if (i % 30 === 0) {
      ctx.textAlign = 'center'
      ctx.font = '500 24px sans-serif'
      ctx.fillText(String(i).padStart(3, '0'), 0, -420)
    }
    if (i % 90 === 0) {
      ctx.font = '600 58px sans-serif'
      ctx.fillText(['N', 'E', 'S', 'W'][i / 90], 0, -333)
    }
    ctx.restore()
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function createCompass(canvas) {
  const renderer = new T.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
  renderer.toneMapping = T.ACESFilmicToneMapping
  const scene = new T.Scene()
  const room = new RoomEnvironment()
  const pmrem = new T.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(room, 0.035)
  scene.environment = environment.texture
  room.dispose()
  pmrem.dispose()
  const camera = new T.PerspectiveCamera(32, 1, 0.008, 60)
  const root = new T.Group()
  scene.add(root)
  const metal = (color, roughness) => new T.MeshStandardMaterial({ color, metalness: 0.94, roughness })
  const steel = metal(0x9da6af, 0.26)
  const polished = metal(0xe5eaff, 0.11)
  const gunmetal = metal(0x383e47, 0.3)
  function mesh(parent, geometry, material) {
    const object = new T.Mesh(geometry, material)
    parent.add(object)
    return object
  }
  function ring(parent, profile, material) {
    const geometry = new T.LatheGeometry(
      profile.map(([r, h]) => new T.Vector2(r, h)),
      160,
    )
    geometry.rotateX(Math.PI / 2)
    return mesh(parent, geometry, material)
  }
  function layer() {
    const group = new T.Group()
    root.add(group)
    return group
  }
  ring(
    root,
    [
      [0.001, -0.2],
      [0.9, -0.2],
      [0.98, -0.165],
      [1, -0.12],
      [1, 0.085],
      [0.986, 0.11],
      [0.94, 0.11],
      [0.915, -0.065],
      [0.001, -0.065],
    ],
    steel,
  )
  ring(
    root,
    [
      [0.994, -0.125],
      [1.002, -0.115],
      [1.002, -0.1],
      [0.998, -0.095],
    ],
    gunmetal,
  )
  const loop = mesh(root, new T.TorusGeometry(0.16, 0.034, 18, 80), polished)
  loop.position.set(0, 1.19, -0.05)
  const mount = mesh(root, new T.CylinderGeometry(0.065, 0.082, 0.145, 40), steel)
  mount.position.set(0, 1.015, -0.05)
  // Turned bearing and retaining screws are exposed as the dial lifts.
  ring(
    root,
    [
      [0.001, -0.061],
      [0.17, -0.061],
      [0.17, -0.046],
      [0.13, -0.036],
      [0.058, -0.036],
      [0.052, 0.01],
      [0.001, 0.01],
    ],
    gunmetal,
  )
  for (let i = 0; i < 3; i++) {
    const angle = ((i * 2) / 3 + 0.15) * Math.PI
    const screw = new T.Group()
    root.add(screw)
    screw.position.set(0.72 * Math.cos(angle), 0.72 * Math.sin(angle), -0.052)
    ring(
      screw,
      [
        [0.001, 0],
        [0.045, 0],
        [0.04, 0.011],
        [0.001, 0.011],
      ],
      polished,
    )
    mesh(screw, new T.BoxGeometry(0.055, 0.008, 0.003), gunmetal).position.z = 0.012
    screw.rotation.z = angle
  }
  const dial = layer()
  const texture = engravedFace()
  mesh(
    dial,
    new T.CircleGeometry(0.936, 160),
    new T.MeshStandardMaterial({ map: texture, roughness: 0.56, metalness: 0.27 }),
  )
  ring(
    dial,
    [
      [0.927, -0.032],
      [0.94, -0.026],
      [0.94, 0],
      [0.927, 0.002],
    ],
    polished,
  )
  const bezel = layer()
  ring(
    bezel,
    [
      [0.919, -0.045],
      [0.978, -0.045],
      [0.994, -0.027],
      [0.989, 0.006],
      [0.971, 0.022],
      [0.932, 0.022],
      [0.918, 0.009],
      [0.919, -0.045],
    ],
    polished,
  )
  const needle = layer()
  function blade(length, material, shade) {
    for (const sign of [-1, 1]) {
      const geometry = new T.BufferGeometry()
      geometry.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [0, length, 0, sign * 0.081, 0, 0.006, 0, -length * 0.09, 0.069],
          3,
        ),
      )
      geometry.computeVertexNormals()
      const mat = sign === 1 ? material : shade
      mat.side = T.DoubleSide
      mesh(needle, geometry, mat)
    }
  }
  blade(0.74, metal(0x164dff, 0.24), metal(0x1236ad, 0.31))
  blade(-0.61, polished, steel)
  ring(
    needle,
    [
      [0.001, -0.09],
      [0.035, -0.09],
      [0.035, 0.055],
      [0.083, 0.055],
      [0.086, 0.072],
      [0.064, 0.084],
      [0.001, 0.084],
    ],
    polished,
  )
  const glass = layer()
  const lens = new T.MeshPhysicalMaterial({
    color: 0xe0edff,
    transparent: true,
    opacity: 0.075,
    metalness: 0.18,
    roughness: 0.06,
    clearcoat: 1,
    depthWrite: false,
    side: T.DoubleSide,
  })
  const dome = mesh(glass, new T.SphereGeometry(0.92, 112, 24, 0, 2 * Math.PI, 0, Math.PI / 2), lens)
  dome.rotation.x = Math.PI / 2
  dome.scale.y = 0.032
  ring(
    glass,
    [
      [0.915, -0.005],
      [0.924, 0],
      [0.919, 0.01],
    ],
    polished,
  )
  const light = new T.DirectionalLight(0x2359ff, 4.5)
  light.position.set(-3, -2, 1.8)
  scene.add(light)
  const rim = new T.DirectionalLight(0xeaf5ff, 2.3)
  rim.position.set(2, 3, 2)
  scene.add(rim)
  let width = 0,
    height = 0
  return {
    draw(p, w, h) {
      if (!w || !h) return
      if (w !== width || h !== height) {
        width = w
        height = h
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
      const side = ease(0.09, 0.42, p) * (1 - ease(0.54, 0.76, p))
      const settle = ease(0.53, 0.76, p)
      const fly = ease(0.76, 0.967, p)
      const lift = (a, b) => ease(a, b, p) * (1 - settle)
      glass.position.z = 0.153 + 1.62 * lift(0.06, 0.28)
      bezel.position.z = 0.12 + 1.09 * lift(0.14, 0.35)
      needle.position.z = 0.04 + 0.73 * lift(0.2, 0.41)
      dial.position.z = -0.025 + 0.36 * lift(0.26, 0.46)
      bezel.rotation.z = side * 0.18
      dial.rotation.z = side * -0.12
      needle.rotation.z =
        -0.32 * (1 - settle) +
        side * 0.45 +
        0.065 * Math.sin(Math.PI * ease(0.64, 0.78, p) * 2) * (1 - ease(0.72, 0.78, p))
      root.rotation.set(-0.52 * (1 - settle), -0.36 * (1 - settle) - side * 0.59, -0.14 * (1 - settle))
      const distance = Math.max(6.35, 4.15 / camera.aspect)
      camera.position.set(side * 1.05, 0, distance + distance * 0.18 * side - (distance - 0.018) * fly)
      const opening = 1 - ease(0, 0.2, p)
      const offset = opening * 0.19 * distance * Math.tan((16 * Math.PI) / 180) * 2
      camera.lookAt(-side * 0.27, offset, side * 0.45)
      renderer.render(scene, camera)
    },
    dispose() {
      const materials = new Set()
      root.traverse((obj) => {
        obj.geometry?.dispose()
        if (obj.material) materials.add(obj.material)
      })
      materials.forEach((m) => m.dispose())
      texture.dispose()
      environment.dispose()
      renderer.dispose()
    },
  }
}
