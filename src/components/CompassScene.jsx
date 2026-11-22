import { useEffect, useRef } from 'react'
import * as T from 'three'

import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

export default function CompassScene({ progress }) {
  const host = useRef(null)
  useEffect(() => {
    const root = host.current
    let renderer
    try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true }) } catch { return }
    root.append(renderer.domElement)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    const scene = new T.Scene()
    renderer.toneMapping = T.ACESFilmicToneMapping
    const room = new RoomEnvironment()
    const pmrem = new T.PMREMGenerator(renderer)
    const reflections = pmrem.fromScene(room, 0.04)
    scene.environment = reflections.texture
    room.dispose()
    pmrem.dispose()
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 40)
    camera.position.z = 8.4
    const dial = new T.Group()
    scene.add(dial)
    const material = (color, metalness = 0.35) => new T.MeshStandardMaterial({ color, metalness, roughness: 0.32 })
    const steel = material(0xc2c9d3, 0.94), face = material(0x212733), ink = material(0xb2c2dc), blue = material(0x296dff)
    const mesh = (geometry, mat, parent = dial) => { const item = new T.Mesh(geometry, mat); parent.add(item); return item }
    const body = mesh(new T.CylinderGeometry(2.15, 1.98, 0.52, 144), face)
    body.position.z = -0.13
    body.rotation.x = Math.PI / 2
    for (const [radius, thickness, depth] of [[2.12, 0.105, 0.11], [1.99, 0.028, 0.17], [1.53, 0.012, 0.14]]) {
      mesh(new T.TorusGeometry(radius, thickness, 12, 160), steel).position.z = depth
    }
    for (let i = 0; i < 120; i++) {
      const angle = i * Math.PI / 60, major = i % 10 === 0
      const tick = mesh(new T.BoxGeometry(major ? 0.032 : 0.014, major ? 0.20 : 0.08, 0.016), major ? ink : steel)
      tick.position.set(-Math.sin(angle) * 1.84, Math.cos(angle) * 1.84, 0.16)
      tick.rotation.z = angle
    }
    const needle = new T.Group()
    dial.add(needle)
    for (const [direction, mat] of [[1, blue], [-1, steel]]) {
      const g = new T.BufferGeometry()
      const vertices = [-0.24,0,0, 0,1.73*direction,0, 0,0,0.21, 0,0,0.21, 0,1.73*direction,0, 0.24,0,0]
      g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3))
      g.computeVertexNormals()
      mat.side = T.DoubleSide
      mesh(g, mat, needle).position.z = 0.23
    }
    mesh(new T.SphereGeometry(0.14, 24, 16), steel).position.z = 0.42
    scene.add(new T.HemisphereLight(0xf0f5ff, 0x444e70, 2.3))
    for (const [color, strength, x,y,z] of [[0xffffff,4,-3,5,5],[0x2869ff,5,4,-2,3]]) {
      const light = new T.DirectionalLight(color, strength)
      light.position.set(x,y,z)
      scene.add(light)
    }
    const lift = new T.Group()
    scene.add(lift)
    const wood = material(0x967056, 0.12)
    const lamp = new T.MeshBasicMaterial({color:0xffe5bc})
    function panel(w,h,d,x,y,z,mat) {
      const part = mesh(new RoundedBoxGeometry(w,h,d,2,0.025),mat,lift)
      part.position.set(x,y,z)
      return part
    }
    panel(2.8,3.9,.18,0,0,-.75,wood)
    for (const side of [-1,1]) {
      panel(.16,4,1.1,side*1.37,0,-.25,steel)
      panel(.18,4.15,.22,side*1.48,0,.37,face)
      panel(.04,3.5,.03,side*1.23,0,-.62,lamp)
    }
    panel(2.95,.16,1.18,0,-1.96,-.22,steel)
    panel(2.95,.16,1.18,0,1.96,-.22,steel)
    panel(1.95,.045,.66,0,1.86,-.23,lamp)
    panel(2.32,.065,.09,0,-.45,-.55,steel)
    const leaves = [-1,1].map(side => panel(1.32,3.78,.12,side*.67,0,.3,steel))
    panel(.28,.52,.1,1.72,-.18,.34,face)
    panel(.08,.08,.04,1.72,-.14,.41,blue)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    function draw() {
      const p = reduced.matches ? 0 : progress.current
      const smooth = (a,b) => T.MathUtils.smoothstep(p,a,b)
      const swap = smooth(.12,.43)
      const halfWidth = camera.position.z * Math.tan(T.MathUtils.degToRad(17)) * camera.aspect
      dial.visible = swap < 1
      dial.position.set(-swap*(halfWidth+3),swap*.4,-swap*2)
      dial.rotation.set(-.53+p*.4,.35+p*1.7,-.15)
      lift.visible = p > .16
      const narrow = root.clientWidth <= 660
      lift.scale.setScalar(narrow ? .65 : .91)
      lift.position.set((1-smooth(.16,.45))*(halfWidth+3)+(narrow ? 0 : halfWidth*.42),narrow ? 1.22 : 0,-.25)
      lift.rotation.y = -.32 + smooth(.5,1)*.53
      leaves.forEach((leaf,i) => {
        const open = smooth(.47,.87)
        leaf.scale.x = 1-open*.97
        leaf.position.x = (i ? 1 : -1)*(.67+.65*open)
      })
      dial.scale.setScalar(1.08 - p * 0.22)
      needle.rotation.z = -0.55 - p * 2.55
      renderer.render(scene, camera)
    }
    function size() {
      const { clientWidth: w, clientHeight: h } = root
      renderer.setSize(w, h)
      camera.aspect = w / Math.max(1,h)
      camera.position.z = Math.max(8, 8.3 / camera.aspect)
      camera.updateProjectionMatrix()
      draw()
    }
    const observer = new ResizeObserver(size)
    observer.observe(root)
    let frame = 0
    const redraw = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(draw) }
    window.addEventListener('scroll', redraw, { passive: true })
    size()
    return () => {
      window.removeEventListener('scroll', redraw); cancelAnimationFrame(frame); observer.disconnect()
      scene.traverse(item => item.geometry?.dispose())
      for (const m of [steel,face,ink,blue,wood,lamp]) m.dispose()
      reflections.dispose(); renderer.dispose(); renderer.domElement.remove()
    }
  }, [progress])
  return <div className="edition-canvas" ref={host} />
}
