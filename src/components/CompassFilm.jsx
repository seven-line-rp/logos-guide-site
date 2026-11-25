import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

const clamp = (v) => Math.max(0, Math.min(1, v))
const ease = (a,b,p) => { const t=clamp((p-a)/(b-a)); return t*t*(3-2*t) }

export default function CompassFilm({ stageRef }) {
  const host = useRef(null)
  useEffect(() => {
    const el=host.current, stage=stageRef.current
    if (!el || !stage || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let renderer
    try { renderer=new THREE.WebGLRenderer({alpha:true,antialias:true}) } catch { return }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.toneMapping=THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure=1.25
    const scene=new THREE.Scene()
    const camera=new THREE.PerspectiveCamera(36,1,.015,100)
    const pmrem=new THREE.PMREMGenerator(renderer)
    const room=new RoomEnvironment()
    const env=pmrem.fromScene(room,.04)
    room.dispose()
    scene.environment=env.texture
    scene.environmentIntensity=.85
    const root=new THREE.Group()
    scene.add(root)
    const steel=new THREE.MeshStandardMaterial({color:0x89929d,metalness:1,roughness:.29})
    const edge=new THREE.MeshStandardMaterial({color:0xc1cad5,metalness:1,roughness:.13})
    const dark=new THREE.MeshStandardMaterial({color:0x171b22,metalness:.65,roughness:.48})
    const blue=new THREE.MeshStandardMaterial({color:0x397dff,metalness:.55,roughness:.24,emissive:0x0b36a0,emissiveIntensity:.4})
    const glass=new THREE.MeshPhysicalMaterial({color:0xc2dcff,metalness:.1,roughness:.08,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide,clearcoat:1})
    const mesh=(g,m,parent,x=0,y=0,z=0)=>{const o=new THREE.Mesh(g,m);o.position.set(x,y,z);parent.add(o);return o}
    const disk=(r,h,m,parent,z)=>{const o=mesh(new THREE.CylinderGeometry(r,r,h,96),m,parent,0,0,z);o.rotation.x=Math.PI/2;return o}
    const ring=(r,t,m,parent,z)=>mesh(new THREE.TorusGeometry(r,t,12,128),m,parent,0,0,z)
    const group=(z)=>{const g=new THREE.Group();g.position.z=z;root.add(g);return g}
    const body=group(0), dial=group(.15), needle=group(.25), bezel=group(.31), lens=group(.37)
    disk(1.46,.28,steel,body,0)
    disk(1.39,.025,dark,body,.15)
    ring(1.425,.035,edge,body,-.12)
    ring(1.43,.035,edge,body,.12)
    disk(1.30,.045,dark,dial,0)
    const face=document.createElement('canvas');face.width=face.height=1024
    const ctx=face.getContext('2d')
    ctx.translate(512,512)
    ctx.fillStyle='#171c24';ctx.beginPath();ctx.arc(0,0,510,0,Math.PI*2);ctx.fill()
    for(let i=0;i<360;i+=3){
      const a=i*Math.PI/180, long=i%30===0, r=475, inner=r-(long?48:i%15===0?30:13)
      ctx.strokeStyle=long?'#d4dce8':'#677383';ctx.lineWidth=long?4:2
      ctx.beginPath();ctx.moveTo(Math.sin(a)*inner,-Math.cos(a)*inner);ctx.lineTo(Math.sin(a)*r,-Math.cos(a)*r);ctx.stroke()
    }
    ctx.textAlign='center';ctx.textBaseline='middle'
    for(const [i,label] of ['N','E','S','W'].entries()){
      const a=i*Math.PI/2;ctx.fillStyle=i===0?'#75a8ff':'#dbe0e8';ctx.font='600 64px sans-serif';ctx.fillText(label,Math.sin(a)*355,-Math.cos(a)*355)
    }
    ctx.fillStyle='#9aa5b5';ctx.font='500 26px sans-serif';ctx.fillText('LOGOS',0,145);ctx.font='18px sans-serif';ctx.fillText('PRECISION NAVIGATION',0,180)
    const tex=new THREE.CanvasTexture(face);tex.colorSpace=THREE.SRGBColorSpace
    mesh(new THREE.CircleGeometry(1.29,96),new THREE.MeshStandardMaterial({map:tex,roughness:.65,metalness:.12}),dial,0,0,.025)
    const half=(sign,mat)=>{const s=new THREE.Shape();s.moveTo(0,sign*1.08);s.lineTo(-.115,0);s.lineTo(.115,0);s.closePath();mesh(new THREE.ExtrudeGeometry(s,{depth:.025,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:2,steps:1}),mat,needle)}
    half(1,blue);half(-1,edge);disk(.11,.09,edge,needle,.045);disk(.035,.015,dark,needle,.095)
    ring(1.36,.085,steel,bezel,0);ring(1.42,.022,edge,bezel,.05);ring(1.29,.018,edge,bezel,.045)
    disk(1.29,.045,glass,lens,0);ring(1.29,.013,glass,lens,.022)
    const key=new THREE.DirectionalLight(0xe5edff,3.5);key.position.set(4,5,7);scene.add(key)
    const rim=new THREE.DirectionalLight(0x174fff,5);rim.position.set(-5,2,-2);scene.add(rim)
    const fill=new THREE.DirectionalLight(0xb8d5ff,1.6);fill.position.set(3,-4,1);scene.add(fill)
    el.appendChild(renderer.domElement);el.dataset.ready='true'
    let frame=0, lost=false
    const draw=()=>{
      frame=0;if(lost)return
      const rect=stage.getBoundingClientRect(), travel=stage.offsetHeight-stage.firstElementChild.clientHeight
      const p=clamp(-rect.top/Math.max(1,travel))
      const spread=(a,b)=>ease(a,b,p)*(1-ease(.52,.73,p))
      lens.position.z=.37+2.6*spread(.10,.25)
      bezel.position.z=.31+1.95*spread(.16,.31)
      needle.position.z=.25+1.3*spread(.22,.37)
      dial.position.z=.15+.64*spread(.28,.43)
      lens.rotation.y=.10*spread(.10,.25)
      bezel.rotation.z=.13*spread(.16,.31)
      needle.rotation.z=.48*(1-ease(.55,.77,p))+.23*spread(.22,.37)
      root.rotation.set(-.29*(1-ease(.49,.76,p)),.26*(1-ease(.49,.76,p)),0)
      const fly=ease(.77,.98,p)
      camera.position.set(2.0*spread(.12,.43),.6*spread(.12,.43),12.2-12.12*fly)
      camera.lookAt(0,0,-.5)
      renderer.render(scene,camera)
    }
    const schedule=()=>{if(!frame&&!lost)frame=requestAnimationFrame(draw)}
    const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.fov=w/h<1?50:36;camera.updateProjectionMatrix();schedule()}
    const observer=new ResizeObserver(resize);observer.observe(el)
    const contextLost=(event)=>{event.preventDefault();lost=true;delete el.dataset.ready}
    renderer.domElement.addEventListener('webglcontextlost',contextLost)
    window.addEventListener('scroll',schedule,{passive:true});resize()
    return ()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('scroll',schedule);renderer.domElement.removeEventListener('webglcontextlost',contextLost);scene.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});tex.dispose();env.dispose();pmrem.dispose();renderer.dispose();renderer.domElement.remove();delete el.dataset.ready}
  },[stageRef])
  return <div ref={host} className="compass-film" aria-hidden="true"><img src="/art/edition-compass.webp" alt="" /></div>
}
