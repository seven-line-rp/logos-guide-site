import { useEffect, useRef } from 'react'
import * as T from 'three'

export default function CompassScene({ progress }) {
  const host = useRef(null)
  useEffect(() => {
    const root = host.current
    let renderer
    try { renderer = new T.WebGLRenderer({ alpha: true, antialias: true }) } catch { return }
    root.append(renderer.domElement)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    const scene = new T.Scene()
    const camera = new T.PerspectiveCamera(34, 1, 0.1, 40)
    camera.position.z = 8.4
    const dial = new T.Group()
    scene.add(dial)
    const material = (color, metalness = 0.35) => new T.MeshStandardMaterial({ color, metalness, roughness: 0.32 })
    const steel = material(0x9da8bb), face = material(0x212733), ink = material(0xb2c2dc), blue = material(0x296dff)
    const mesh = (geometry, mat, parent = dial) => { const item = new T.Mesh(geometry, mat); parent.add(item); return item }
    const body = mesh(new T.CylinderGeometry(2.15, 2.08, 0.26, 144), face)
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
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    function draw() {
      const p = reduced.matches ? 0 : progress.current
      dial.rotation.set(-0.38 + p * 0.25, 0.12 + p * 0.52, -0.12)
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
      for (const m of [steel,face,ink,blue]) m.dispose()
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [progress])
  return <div className="edition-canvas" ref={host} />
}
