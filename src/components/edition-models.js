import * as T from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const finish = (color, metalness, roughness) => new T.MeshStandardMaterial({ color, metalness, roughness })
function part(parent, shape, surface, x=0, y=0, z=0) {
  const mesh = new T.Mesh(shape, surface)
  mesh.position.set(x,y,z)
  parent.add(mesh)
  return mesh
}
function slab(parent, dimensions, surface, x,y,z, bevel=0.035) {
  return part(parent,new RoundedBoxGeometry(...dimensions,2,bevel),surface,x,y,z)
}
function disc(parent,radius,depth,surface,z) {
  const obj = part(parent,new T.CylinderGeometry(radius,radius,depth,96),surface,0,0,z)
  obj.rotation.x = Math.PI/2
  return obj
}
function print(parent, width, height, paint, x,y,z) {
  const canvas = document.createElement('canvas')
  canvas.width=1024; canvas.height=Math.max(64,Math.round(1024*height/width))
  paint(canvas.getContext('2d'),canvas.width,canvas.height)
  const map = new T.CanvasTexture(canvas)
  map.colorSpace=T.SRGBColorSpace
  return part(parent,new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}),x,y,z)
}
function lettering(parent,text,width,height,x,y,z,color='#e5edfa') {
  return print(parent,width,height,(ctx,w,h) => {
    ctx.fillStyle=color; ctx.font='600 '+Math.round(h*.78)+'px sans-serif'
    ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,w/2,h*.52,w*.96)
  },x,y,z)
}
export function compassModel() {
  const group=new T.Group(), needle=new T.Group()
  const chrome=finish(0xd8e0ed,.96,.17), steel=finish(0x9ba8bb,.91,.25)
  disc(group,2.04,.38,steel,-.08)
  for (const [radius,tube,z] of [[2.02,.078,.13],[1.94,.026,.17],[2.015,.035,-.26]]) {
    part(group,new T.TorusGeometry(radius,tube,16,160),chrome,0,0,z)
  }
  const crown=part(group,new T.CylinderGeometry(.17,.22,.3,40),steel,0,2.14,-.06)
  part(group,new T.TorusGeometry(.47,.065,20,96),chrome,0,crown.position.y+.54,-.06)
  disc(group,1.94,.1,finish(0x111b28,.47,.38),.09)
  print(group,3.82,3.82,(ctx,w) => {
    ctx.translate(w/2,w/2)
    for(let i=0;i<180;i++){
      ctx.save();ctx.rotate(i*Math.PI/90)
      ctx.fillStyle=i%15===0?'#f2f5fb':'#cad6e4'
      ctx.fillRect(-1.6,-485,i%15===0?5:2,i%5===0?37:15)
      if(i%15===0){ctx.textAlign='center';ctx.font='bold 26px sans-serif';ctx.fillText(String(i*2),0,-405)}
      ctx.restore()
    }
    ctx.textAlign='center';ctx.font='600 65px sans-serif'
    for(const [label,x,y] of [['N',0,-280],['S',0,325],['W',-311,22],['E',311,22]]) {
      ctx.fillStyle=label==='N'?'#f2f5fb':'#b7c1cc';ctx.fillText(label,x,y)
    }
  },0,0,.149)
  group.add(needle)
  for(const [dir,color] of [[1,0xd82b38],[-1,0xc6d0dc]]){
    const geometry=new T.ConeGeometry(.29,1.67,6)
    const blade=part(needle,geometry,finish(color,.32,.25),0,dir*.8,.29)
    blade.rotation.y=Math.PI/4;blade.rotation.z=dir===1?0:Math.PI
    blade.scale.z=.61
  }
  disc(needle,.18,.2,steel,.43)
  disc(group,.085,.04,chrome,.55)
  const glass=new T.MeshPhysicalMaterial({color:0xbdd7f3,metalness:.12,roughness:.09,clearcoat:1,transparent:true,opacity:.085,depthWrite:false})
  disc(group,1.91,.048,glass,.51)
  part(group,new T.TorusGeometry(1.9,.018,12,128),glass,0,0,.53)
  return {group,needle}
}
export function elevatorModel() {
  const group=new T.Group(), doors=[]
  const casing=finish(0x333c49,.82,.34), steel=finish(0xa5adb4,.91,.29), oak=finish(0x77533b,.1,.47)
  const glow=new T.MeshBasicMaterial({color:0xd2e6ff})
  slab(group,[3.15,4.08,.28],casing,0,0,-.56)
  slab(group,[2.55,3.46,.1],oak,0,-.12,-.35)
  const mirror=new T.MeshPhysicalMaterial({color:0xb6c8d4,metalness:.92,roughness:.09,clearcoat:1})
  slab(group,[1.86,1.46,.035],mirror,0,.48,-.26)
  for(const x of [-.99,.99]) slab(group,[.025,3.35,.03],steel,x,-.12,-.275,.008)
  for(const y of [-1.2,-.78]) slab(group,[2.47,.016,.028],casing,0,y,-.275,.006)
  for(const x of [-1.04,1.04]) slab(group,[.04,.045,.68],glow,x,1.53,.02,.012)
  slab(group,[2.54,.06,.85],casing,0,-1.79,-.02)
  const buttons=slab(group,[.21,.74,.04],steel,1.08,.06,-.24)
  lettering(buttons,'2',.16,.18,0,.18,.025)
  lettering(buttons,'1',.16,.18,0,-.13,.025)
  for(const side of [-1,1]){
    slab(group,[.32,3.95,1],steel,side*1.48,0,-.1)
    slab(group,[.08,3.35,.06],glow,side*1.21,-.14,-.18)
    const leaf=slab(group,[1.28,3.42,.11],steel,side*.65,-.13,.34)
    doors.push(leaf)
  }
  slab(group,[3.27,.4,1],casing,0,1.85,-.08)
  slab(group,[3.27,.17,1.15],steel,0,-1.91,-.03)
  slab(group,[1.8,.047,.08],steel,0,-.42,-.21)
  slab(group,[.74,.25,.06],finish(0x0c1623,.4,.2),0,1.85,.47)
  lettering(group,'↑  02',.64,.19,0,1.85,.508,'#8abaff')
  slab(group,[.25,.63,.12],casing,1.79,-.04,.2)
  lettering(group,'▲',.19,.16,1.79,.01,.27)
  return {group,doors}
}
export function booksModel() {
  const group=new T.Group()
  const paper=finish(0xd8ccb3,.02,.72)
  for(const [i,color,angle,title] of [[0,0x233d76,-.13,'ЛИТЕРАТУРА'],[1,0x59402e,.13,'ЧИТАЛЬНЫЙ ЗАЛ'],[2,0x1e3331,-.04,'БИБЛИОТЕКА']]){
    const book=new T.Group();group.add(book)
    book.position.set(i*.045,(i-1)*.52,0);book.rotation.y=angle
    const cover=finish(color,.15,.44)
    slab(book,[3.03,.41,2.03],paper,.04,0,0)
    for(const y of [-.23,.23])slab(book,[3.18,.07,2.16],cover,0,y,0)
    slab(book,[3.18,.49,.14],cover,0,0,1.03)
    lettering(book,title,2.36,.18,0,0,1.109,'#d7bc83')
    for(const x of [-1.35,1.35])slab(book,[.035,.42,.025],finish(0xc2a26e,.66,.32),x,0,1.1,.007)
  }
  const coverTitle=lettering(group,'214',1.65,.71,0,.797,0,'#d9c38d')
  coverTitle.rotation.x=-Math.PI/2
  return group
}
