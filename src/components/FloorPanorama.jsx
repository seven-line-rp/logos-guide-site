import { useEffect, useRef, useState } from 'react'
import * as T from 'three'
import { floorWalls } from '../hero-scene-model.js'
import { circulation, pointInPolygon, roomAccess } from '../map-geometry.js'
import { corridorFinish, furnishHall } from './panorama-interior.js'
import { rooms } from '../data.js'

export default function FloorPanorama({ floor, onExit }) {
  const host = useRef(null)
  const actions = useRef(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const el = host.current
    let renderer
    try { renderer = new T.WebGLRenderer({ antialias: true }) } catch { setFailed(true); return }
    renderer.toneMapping = T.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.23
    el.append(renderer.domElement)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    const scene = new T.Scene()
    scene.background = new T.Color(0x252b36)
    scene.fog = new T.FogExp2(0x92999f, 0.0036)
    const camera = new T.PerspectiveCamera(74, 1, 0.2, 720)
    camera.position.set(74, 9, 168)
    let yaw = Math.PI / 2, pitch = 0
    const wall = corridorFinish(0xd2cdc1)
    const door = new T.MeshStandardMaterial({ color: 0x78563f })
    const trim = new T.MeshStandardMaterial({color:0x4e5355,roughness:.44})
    const rail = new T.MeshStandardMaterial({color:0xb7b6ab,metalness:.55,roughness:.29})
    const boxes = new Map()
    const unitBox = new T.BoxGeometry(1,1,1)
    function box(w,h,d,x,y,z,mat,angle = 0) {
      const object = new T.Object3D()
      object.scale.set(w,h,d); object.position.set(x,y,z); object.rotation.y = angle; object.updateMatrix()
      if (!boxes.has(mat)) boxes.set(mat,[])
      boxes.get(mat).push(object.matrix)
    }
    const blockedByFurniture = furnishHall(scene,floor)
    box(680,1,530,305,21,240,wall)
    for (const segment of floorWalls(floor)) {
      const a = segment.angle * Math.PI / 180
      const x = segment.x + Math.cos(a)*segment.length/2, z = segment.y + Math.sin(a)*segment.length/2
      box(segment.length,20,.65,x,10,z,wall,-a)
      box(segment.length,.75,.84,x,.38,z,trim,-a)
      box(segment.length,.22,.77,x,6.3,z,rail,-a)
    }
    for (const room of rooms.filter(room => room.floor === floor && roomAccess[room.id])) {
      const {door: [x,z], branch} = roomAccess[room.id]
      const side = branch === 'west'
      box(side ? 1.2 : 7.65,14.45,side ? 7.65 : 1.2,x,7.22,z,trim)
      box(side ? 1.4 : 7,14,side ? 7 : 1.4,x,7,z,door)
      box(side ? 1.8 : .85,.28,side ? .85 : 1.8,x+(side?0:2.5),6.4,z+(side?2.5:0),rail)
      const canvas = document.createElement('canvas')
      canvas.width = 512; canvas.height = 80
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#18283c'; ctx.fillRect(0,0,512,80)
      ctx.fillStyle = '#f3f6ff'; ctx.font = 'bold 38px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(room.number ? '№ ' + room.number : room.name,256,53,490)
      const texture = new T.CanvasTexture(canvas)
      texture.colorSpace = T.SRGBColorSpace
      const label = new T.Sprite(new T.SpriteMaterial({ map: texture }))
      label.position.set(side ? x + Math.sign(74-x)*1.5 : x,16,side ? z : z + Math.sign(168-z)*1.5)
      label.scale.set(12,2.4,1)
      scene.add(label)
    }
    for (const [material, matrices] of boxes) {
      const batch = new T.InstancedMesh(unitBox,material,matrices.length)
      matrices.forEach((matrix,i) => batch.setMatrixAt(i,matrix)); scene.add(batch)
    }
    scene.add(new T.HemisphereLight(0xfff1d8,0x828eaa,1.55))
    const lamps = Array.from({length:2},() => new T.PointLight(0xffe7bd,200,65,1.6))
    scene.add(...lamps)
    const light = new T.DirectionalLight(0xe8f0ff,1.8)
    light.position.set(3,5,-1); scene.add(light)
    function draw() {
      const west = camera.position.z > 185 && camera.position.x < 91
      const axis = west ? camera.position.z : camera.position.x
      const span = west ? 46 : 45, start = west ? 206 : 24
      const cell = (axis-start)/span, fraction=cell-Math.floor(cell)
      lamps.forEach((light,i) => {
        const at = start+(Math.floor(cell)+i)*span
        light.position.set(west?74:at,19,west?at:168)
        light.intensity = 300*(i?fraction:1-fraction)
      })
      camera.lookAt(camera.position.x + Math.sin(yaw)*Math.cos(pitch),camera.position.y + Math.sin(pitch),camera.position.z - Math.cos(yaw)*Math.cos(pitch))
      renderer.render(scene,camera)
    }
    function act(turn, steps) {
      yaw += turn
      for (let i = 0; i < Math.abs(steps); i++) {
        const x = camera.position.x + Math.sign(steps)*Math.sin(yaw)
        const z = camera.position.z - Math.sign(steps)*Math.cos(yaw)
        if (blockedByFurniture(x,z) || !circulation[floor].some(polygon => pointInPolygon([x,z],polygon))) break
        camera.position.set(x,9,z)
      }
      draw()
    }
    actions.current = act
    const key = e => {
      const movement = { ArrowLeft: [-0.14,0], ArrowRight: [0.14,0], ArrowUp: [0,5], ArrowDown: [0,-5] }[e.key]
      if (movement) { e.preventDefault(); act(...movement) }
    }
    let drag = null
    const down = e => { drag = [e.clientX,e.clientY]; el.setPointerCapture(e.pointerId); el.focus() }
    const move = e => {
      if (!drag) return
      yaw -= (e.clientX-drag[0])*0.006
      pitch = Math.max(-0.9, Math.min(0.9,pitch+(e.clientY-drag[1])*0.005))
      drag = [e.clientX,e.clientY]; draw()
    }
    const up = () => { drag = null }
    const events = { pointerdown: down, pointermove: move, lostpointercapture: up, keydown: key }
    Object.entries(events).forEach(([name,fn]) => el.addEventListener(name,fn))
    const resize = () => { renderer.setSize(el.clientWidth,el.clientHeight); camera.aspect = el.clientWidth / Math.max(1,el.clientHeight); camera.updateProjectionMatrix(); draw() }
    const observer = new ResizeObserver(resize); observer.observe(el); resize()
    return () => {
      actions.current = null; observer.disconnect()
      Object.entries(events).forEach(([name,fn]) => el.removeEventListener(name,fn))
      const surfaces=new Set(), shapes=new Set()
      scene.traverse(obj => { if (obj.geometry) shapes.add(obj.geometry); if (obj.material) surfaces.add(obj.material); if (obj.isInstancedMesh) obj.dispose() })
      for (const shape of shapes) shape.dispose()
      for (const mat of surfaces) { mat.map?.dispose(); mat.dispose() }
      renderer.dispose(); renderer.domElement.remove()
    }
  }, [floor])
  return <div className="floor-pano">
    <div ref={host} className="pano-view" tabIndex={0} role="region" aria-label="Панорама коридора. Стрелки поворачивают камеру и перемещают по этажу." />
    <div className="pano-controls">{failed ? <><span>Браузер не поддерживает 3D.</span><button onClick={onExit}>Вернуться к плану</button></> : <>
      <span>Этаж {floor} · Потяните, чтобы осмотреться</span>
      {[['Повернуть влево','↶',-0.3,0],['Шаг назад','↓',0,-8],['Шаг вперёд','↑',0,8],['Повернуть вправо','↷',0.3,0]].map(([label,icon,turn,steps]) => <button type="button" key={label} aria-label={label} onClick={() => actions.current?.(turn,steps)}>{icon}</button>)}
    </>}</div>
  </div>
}
