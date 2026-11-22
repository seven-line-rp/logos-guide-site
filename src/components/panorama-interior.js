import * as T from 'three'

const fixtures = [
  ...Array.from({length:13},(_,i) => [24+i*45,168]),
  ...Array.from({length:6},(_,i) => [74,206+i*46]),
]
// Bake broad pools of light into the corridor finish in world coordinates.
export function corridorFinish(color) {
  const mat = new T.MeshStandardMaterial({color,roughness:.78})
  mat.onBeforeCompile = shader => {
    shader.vertexShader = 'varying vec3 hallPosition;\n' + shader.vertexShader.replace('#include <project_vertex>', `
      hallPosition = (modelMatrix * instanceMatrix * vec4(transformed,1.)).xyz;
      #include <project_vertex>`)
    shader.fragmentShader = 'varying vec3 hallPosition;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      bool west = hallPosition.z > 184. && hallPosition.x < 91.;
      float along = west ? hallPosition.z - 206. : hallPosition.x - 24.;
      float spacing = west ? 46. : 45.;
      float lamp = abs(mod(along + spacing*.5,spacing)-spacing*.5);
      float height = clamp(hallPosition.y/20.,0.,1.);
      float pool = exp(-lamp*lamp/(45.+90.*height))*(.28+.72*height);
      float base = smoothstep(0.,1.9,hallPosition.y);
      diffuseColor.rgb *= mix(vec3(.60,.63,.68),vec3(1.09,1.0,.83),pool)*mix(.72,1.,base);
    `)
  }
  return mat
}
export function furnishHall(scene,floor) {
  const seats=floor===1 ? [[142,177],[327,177],[469,158]] : [[105,125],[195,179],[346,158]]
  const tile=document.createElement('canvas')
  tile.width=2048;tile.height=1590
  const ctx=tile.getContext('2d'), sx=tile.width/680, sz=tile.height/530
  ctx.scale(sx,sz);ctx.translate(35,25)
  ctx.fillStyle='#a5a099';ctx.fillRect(-35,-25,680,530)
  for(let x=-35;x<645;x+=9)for(let z=-25;z<505;z+=9) {
    const tint=Math.abs(Math.sin(x*12.8+z*78.2))*.12
    ctx.fillStyle='rgba(240,232,215,'+tint+')';ctx.fillRect(x+.15,z+.15,8.7,8.7)
    ctx.strokeStyle='rgba(47,52,55,.36)';ctx.lineWidth=.14;ctx.strokeRect(x,z,9,9)
  }
  function pool(x,z,spread,center,edge) {
    const grad=ctx.createRadialGradient(x,z,0,x,z,spread)
    grad.addColorStop(0,center);grad.addColorStop(1,edge)
    ctx.fillStyle=grad;ctx.fillRect(x-spread,z-spread,spread*2,spread*2)
  }
  for(const [x,z] of fixtures)pool(x,z,18,'rgba(255,244,212,.46)','rgba(255,244,212,0)')
  for(const [x,z] of seats)pool(x,z,9,'rgba(36,32,28,.65)','rgba(36,32,28,0)')
  const map=new T.CanvasTexture(tile);map.colorSpace=T.SRGBColorSpace
  const ground=new T.Mesh(new T.PlaneGeometry(680,530),new T.MeshStandardMaterial({map,roughness:.54}))
  ground.rotation.x=-Math.PI/2;ground.position.set(305,.025,240);scene.add(ground)
  const wood=new T.MeshStandardMaterial({color:0xaa7851,roughness:.55})
  const iron=new T.MeshStandardMaterial({color:0x33404a,metalness:.45,roughness:.34})
  const diffuser=new T.MeshBasicMaterial({color:0xffefd2})
  const blue=new T.MeshStandardMaterial({color:0x305888,roughness:.62})
  const leaf=new T.MeshStandardMaterial({color:0x49684e,roughness:.72})
  const unit=new T.BoxGeometry(1,1,1)
  const items=new Map()
  function add(mat,w,h,d,x,y,z,angle=0,tilt=0) {
    const o=new T.Object3D()
    o.position.set(x,y,z);o.scale.set(w,h,d);o.rotation.set(0,angle,tilt);o.updateMatrix()
    if(!items.has(mat))items.set(mat,[])
    items.get(mat).push(o.matrix)
  }
  for(const [x,z] of fixtures) {
    add(iron,8,.45,2,x,20.1,z);add(diffuser,7.7,.12,1.75,x,19.85,z)
  }
  for(const [x,z] of seats){
    const back=z>166 ? 1 : -1
    for(const offset of [-1,0,1])add(wood,12,.4,.84,x,2.8,z+offset)
    for(const dx of [-4.7,4.7]) {
      add(iron,.45,2.6,2.65,x+dx,1.35,z);add(iron,.45,3.2,.4,x+dx,3.65,z+back*1.28)
    }
    add(wood,12,1.55,.36,x,4.8,z+back*1.32)
    const px=x+9
    add(iron,2.6,3,2.6,px,1.5,z)
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6
      add(leaf,.68,3.8,.21,px+Math.cos(a)*.77,4.35+(i%3)*.32,z+Math.sin(a)*.77,-a,.55)
    }
  }
  // Recessed wall panels and noticeboards along the main hall.
  for(const x of [120,289,456]) {
    add(iron,11,6,.35,x,10,156.2);add(wood,10.5,5.5,.2,x,10,156.48)
    for(const [dx,dy] of [[-3,.4],[0,-.1],[2.9,.55]]) add(diffuser,2.3,3.5,.06,x+dx,10+dy,156.62)
    add(blue,10.5,.45,.15,x,12.6,156.65)
  }
  for(const [material,matrices] of items){
    const batch=new T.InstancedMesh(unit,material,matrices.length)
    matrices.forEach((matrix,i)=>batch.setMatrixAt(i,matrix));scene.add(batch)
  }
  return (x,z) => seats.some(([bx,bz]) => (Math.abs(x-bx)<6.5 && Math.abs(z-bz)<2.1) || Math.hypot(x-bx-9,z-bz)<2)
}
