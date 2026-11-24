import { useEffect, useRef } from 'react'
import * as T from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { booksModel, elevatorModel } from './edition-models.js'

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
    const elevator = elevatorModel(), books = booksModel()
    const models = [elevator.group, books]
    scene.add(...models)
    const positions=new Float32Array(180*3)
    for(let i=0;i<180;i++){
      const a=i*2.399963,r=2.5+Math.sqrt(i/180)*9
      positions[i*3]=Math.cos(a)*r
      positions[i*3+1]=Math.sin(a)*r*.62
      positions[i*3+2]=-3-(i%11)*.42
    }
    const pointsGeometry=new T.BufferGeometry()
    pointsGeometry.setAttribute('position',new T.BufferAttribute(positions,3))
    const pointsMaterial=new T.PointsMaterial({color:0x7fa9ff,size:.027,transparent:true,opacity:.55,depthWrite:false})
    const particles=new T.Points(pointsGeometry,pointsMaterial)
    scene.add(particles)
    // One continuous glowing route ties the three objects together.
    const routeCurve=new T.CatmullRomCurve3([
      new T.Vector3(-3.8,-1.75,-1.6),
      new T.Vector3(-1.9,-1.05,-1.15),
      new T.Vector3(-.65,-.85,-.95),
      new T.Vector3(.45,-.15,-1.2),
      new T.Vector3(1.55,.5,-1.65),
      new T.Vector3(3.9,1.15,-2.2)
    ])
    const route=new T.Group()
    const routeMaterial=new T.MeshBasicMaterial({color:0x62a2ff,transparent:true,opacity:.6,depthWrite:false})
    route.add(new T.Mesh(new T.TubeGeometry(routeCurve,140,.018,8,false),routeMaterial))
    const routeHalo=new T.Mesh(
      new T.TubeGeometry(routeCurve,140,.075,8,false),
      new T.MeshBasicMaterial({color:0x2769f4,transparent:true,opacity:.13,depthWrite:false})
    )
    route.add(routeHalo)
    const marker=new T.Mesh(new T.SphereGeometry(.075,16,12),
      new T.MeshBasicMaterial({color:0xc4e4ff}))
    route.add(marker)
    scene.add(route)
    for (const [color,power,x,y,z] of [[0xffeedc,2.7,-3,5,5],[0xb9cdff,3,4,1,2],[0xc6ddff,2,-2,-1,-3]]) {
      const lamp = new T.DirectionalLight(color,power)
      lamp.position.set(x,y,z); scene.add(lamp)
    }
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const clock = new T.Clock()
    function draw() {
      const position = motion.matches ? Math.round(progress.current) : progress.current
      const t = clock.getElapsedTime()
      const mobile = root.clientWidth < 700
      // Continuously blend neighboring chapters rather than toggling models.
      // The same scene, lights, camera and route persist for the whole scroll.
      const smooth = x => {const u=T.MathUtils.clamp(x,0,1);return u*u*(3-2*u)}
      const baseZ=Math.max(9.3,8.45/camera.aspect)
      const travel=smooth(position/2)
      const close= Math.sin(Math.PI*T.MathUtils.clamp(position,0,2)/2)**2
      camera.position.set(
        (mobile ? 0 : -.38)*travel + .18*Math.sin(Math.PI*position),
        .14*travel,
        baseZ-1.1*close
      )
      camera.lookAt(0,0,0)
      const halfHeight=baseZ*Math.tan(T.MathUtils.degToRad(16))
      const modelX = mobile ? 0 : -.42 * halfHeight * camera.aspect
      models.forEach((model, index) => {
        const i = index + 1
        const distance=Math.abs(position-i)
        // Wider overlapping envelopes leave both objects visible at transitions.
        const envelope=1-smooth((distance-.24)/.94)
        model.visible=envelope>.002
        if(!model.visible)return
        const natural = i === 2 ? 1.16 : 1
        model.scale.setScalar(natural*(.04+.96*envelope))
        model.position.set(modelX + (i-position)*1.1,
          (mobile ? halfHeight*.2 : 0) + (i-position)*.23,
          -1.25*(1-envelope))
      })
      const pathProgress=smooth(position/2)
      route.visible=particles.visible=position>.32
      marker.position.copy(routeCurve.getPoint(pathProgress))
      route.rotation.y=motion.matches ? 0 : .025*Math.sin(t*.25)
      route.position.y=mobile ? -1.25 : -.65
      route.scale.setScalar(mobile?.66:1)
      particles.rotation.z=motion.matches ? 0 : t*.006
      particles.position.x=-travel*.7
      elevator.group.rotation.set(.10,-.31+(position-1)*.3,-.025)
      const open=smooth((position-.67)/.65)*.91
      elevator.doors.forEach((leaf,i)=>{leaf.scale.x=1-open;leaf.position.x=(i?1:-1)*(.65+.64*open)})
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
