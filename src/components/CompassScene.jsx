import { useEffect, useRef } from 'react'
import * as T from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { booksModel, compassModel, elevatorModel } from './edition-models.js'

export default function CompassScene({ progress }) {
  const host = useRef(null)
  useEffect(() => {
    const root = host.current
    let renderer
    try { renderer = new T.WebGLRenderer({ alpha:true, antialias:true }) } catch { return }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65))
    renderer.toneMapping = T.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    renderer.outputColorSpace = T.SRGBColorSpace
    root.append(renderer.domElement)
    const scene = new T.Scene()
    const rig = new RoomEnvironment()
    const pmrem = new T.PMREMGenerator(renderer)
    const reflection = pmrem.fromScene(rig, .045)
    scene.environment = reflection.texture
    rig.dispose(); pmrem.dispose()
    const camera = new T.PerspectiveCamera(32, 1, .1, 40)
    const compass = compassModel(), elevator = elevatorModel(), books = booksModel()
    const models = [compass.group, elevator.group, books]
    scene.add(...models)
    for (const [color,power,x,y,z] of [[0xffeedc,2.7,-3,5,5],[0x2669ff,5,4,1,2],[0xc6ddff,2,-2,-1,-3]]) {
      const lamp = new T.DirectionalLight(color,power)
      lamp.position.set(x,y,z); scene.add(lamp)
    }
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const clock = new T.Clock()
    function draw() {
      const position = motion.matches ? Math.round(progress.current) : progress.current
      const breathe = motion.matches ? 0 : Math.sin(clock.getElapsedTime()*.65)
      const mobile = root.clientWidth < 700
      const halfHeight = camera.position.z * Math.tan(T.MathUtils.degToRad(16))
      models.forEach((model,i) => {
        const d = position-i
        model.visible = Math.abs(d)<.86
        if (!model.visible) return
        const away = T.MathUtils.smoothstep(Math.abs(d),.12,.86)
        model.scale.setScalar((1-away)* (i===2 ? 1.16 : 1))
        model.position.set((i && !mobile ? -.45*halfHeight*camera.aspect : 0) - d*1.8,
          (mobile ? halfHeight*.32 : i ? 0 : halfHeight*.13) + d*.55, -away*2)
      })
      compass.group.rotation.set(.32 + position*.24 + breathe*.035,-.35-position*.58 + breathe*.06,-.12 + breathe*.028)
      compass.needle.rotation.z = -.61-position*2.65 + (motion.matches ? 0 : Math.sin(clock.elapsedTime*.82)*.075)
      elevator.group.rotation.set(.10,-.31+(position-1)*.3,-.025)
      const open=T.MathUtils.smoothstep(position,.75,1.23)*.91
      elevator.doors.forEach((leaf,i) => { leaf.scale.x=1-open; leaf.position.x=(i?1:-1)*(.65+.64*open) })
      books.rotation.set(.45,-.36+(position-2)*.45,-.11)
      renderer.render(scene,camera)
    }
    function size() {
      const w=root.clientWidth, h=root.clientHeight
      renderer.setSize(w,h)
      camera.aspect=w/Math.max(1,h)
      camera.position.z=Math.max(9.3,8.45/camera.aspect)
      camera.updateProjectionMatrix();draw()
    }
    let frame=0, stopped=false
    function schedule() {
      if (!frame) frame=requestAnimationFrame(() => { frame=0; draw() })
    }
    function animate() {
      if (stopped || motion.matches || document.hidden) return
      draw(); frame=requestAnimationFrame(animate)
    }
    if (!motion.matches) frame=requestAnimationFrame(animate)
    const visibility=() => { cancelAnimationFrame(frame);frame=0;if (!document.hidden && !motion.matches) frame=requestAnimationFrame(animate);else schedule() }
    document.addEventListener('visibilitychange',visibility)
    const observer=new ResizeObserver(size)
    observer.observe(root); size()
    window.addEventListener('scroll',schedule,{passive:true});motion.addEventListener('change',visibility)
    return () => {
      stopped=true
      window.removeEventListener('scroll',schedule); motion.removeEventListener('change',visibility);document.removeEventListener('visibilitychange',visibility)
      cancelAnimationFrame(frame);observer.disconnect()
      const materials=new Set()
      scene.traverse(obj => { obj.geometry?.dispose(); if(obj.material) materials.add(obj.material) })
      for(const material of materials){material.map?.dispose();material.dispose()}
      reflection.dispose();renderer.dispose();renderer.domElement.remove()
    }
  },[progress])
  return <div className="edition-canvas" ref={host} />
}
