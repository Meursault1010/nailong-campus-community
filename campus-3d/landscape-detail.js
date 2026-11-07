import {teachingCourts} from './building-proportions.js';
import * as T from 'three';
import {dormLanes} from './ground-layout.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {campusBoundary,lakeOutline,insidePolygon,roadRoutes,routeDistance,gardenPaths,planFootpaths} from './landscape-plan.js';

export function addLandscape({world,mat,instance,buildings,mesh,box,renderer}){
 let seed=43019;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const colors={path:'#c6bfa7',gravel:'#d8cbb0',wood:'#92765b',shrub:'#567947',pine:'#436f56',blossom:'#d7b4bc',leafLight:'#90a168',reeds:'#8c9a5d',stone:'#a9aca0',flowerGold:'#d2bc75',flowerRose:'#c991a0',flowerWhite:'#e5e1c7',grassBlade:'#83a15d',groundCover:'#789464',cladding:'#d4cbb6',asphalt:'#728681'};
 for(const [name,color] of Object.entries(colors))mat[name]=new T.MeshStandardMaterial({color,roughness:.9});
 const details={paths:0,lowBuildings:0,trees:0,shrubs:0,flowers:0,benches:0};
 function grainTexture(base,variation){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.fillStyle=base;ctx.fillRect(0,0,256,256);for(let i=0;i<18000;i++){const v=Math.round(100+random()*130);ctx.fillStyle=`rgba(${v},${v},${v},${variation})`;ctx.fillRect(random()*256,random()*256,1+random()*2,1+random()*2);}const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),8);return texture;}
 const grassTexture=grainTexture('#b4c295',.18);grassTexture.repeat.set(.12,.12);mat.grass.map=grassTexture;
 const pathTexture=grainTexture('#f2eee1',.2);pathTexture.repeat.set(.16,.16);mat.path.map=pathTexture;
 const waterMask=(x,z)=>insidePolygon(x,z,lakeOutline);
 const accessoryPlan=[[-122,208,18,9,4,'pavilion'],[282,256,17,9,4,'pavilion'],[-213,-292,16,10,4,'pavilion'],[-287,215,16,10,4,'pavilion'],[-31,341,10,7,4.5,'lodge'],[31,341,10,7,4.5,'lodge'],[12,-337,9,7,4.5,'lodge'],[525,-145,10,7,4.5,'lodge'],[-557,114,11,7,4.5,'lodge'],[-379,106,22,12,6,'service'],[-395,290,22,12,6,'service'],[383,190,27,14,7,'service'],[-283,-337,23,12,6,'service'],[350,-228,24,11,6,'service']];
 const buildingBlocked=(x,z,margin=2)=>buildings.some(b=>Math.abs(x-b.x)<b.w/2+margin&&Math.abs(z-b.z)<b.d/2+margin);
 const blocked=(x,z,margin=2)=>buildingBlocked(x,z,margin)||accessoryPlan.some(([cx,cz,w,d])=>Math.abs(x-cx)<w/2+margin&&Math.abs(z-cz)<d/2+margin);
 const inGround=(x,z,margin=2)=>insidePolygon(x,z,campusBoundary)&&!blocked(x,z,margin)&&!waterMask(x,z);
 const allPaths=planFootpaths(buildings).concat(gardenPaths,dormLanes(buildings));
 const pathSamples=[];const merged={path:[],bank:[],wood:[]};
 function ribbon(points,width,y){const vertices=[],indices=[];for(let i=0;i<points.length;i++){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;const nx=-dz/len*width/2,nz=dx/len*width/2;vertices.push(points[i].x+nx,y,points[i].z+nz,points[i].x-nx,y,points[i].z-nz);if(i<points.length-1){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}}const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(vertices.flatMap((v,i)=>i%3===1?[]:[v]),2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;}
 for(const path of allPaths){const curve=new T.CatmullRomCurve3(path.points.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal');const samples=curve.getSpacedPoints(Math.max(8,Math.ceil(curve.getLength()/2)));let run=[];const flush=()=>{if(run.length>1){merged.bank.push(ribbon(run,path.width+1.1,.82));merged.path.push(ribbon(run,path.width,1.12));pathSamples.push(...run.map(p=>[p.x,p.z,path.width]));details.paths++;}run=[];};for(const p of samples){if(inGround(p.x,p.z,path.width/2+1))run.push(p);else flush();}flush();}
 const nearPath=(x,z,padding=3)=>pathSamples.some(p=>Math.hypot(x-p[0],z-p[1])<p[2]/2+padding)||roadRoutes.some(r=>routeDistance(x,z,[r])<r.width/2+padding);
 function tree(x,z,s=1,type='broad'){if(!inGround(x,z,5)||nearPath(x,z,3.5))return false;
  instance('trunk',x,3.2*s,z,.65*s,6.4*s,.65*s);
  if(type==='pine'){for(let i=0;i<3;i++)instance('pine',x,(5+i*2.7)*s,z,(6-i*1.3)*s,(7-i*.8)*s,(6-i*1.3)*s);}
  else {const leaf=type==='blossom'?'blossom':type==='light'?'leafLight':'canopy';for(let i=0;i<5;i++){const a=i*2.4,spread=i?2.1:0;instance(leaf,x+Math.cos(a)*spread*s,(7.6+(i%2)*1.4)*s,z+Math.sin(a)*spread*s,(5.7+random())*s,(6+random()*2)*s,(5.3+random())*s);}
   for(const side of [-1,1])instance('branch',x+side*.7*s,4.8*s,z,.32*s,4*s,.32*s,0,0,side*.5);
  }details.trees++;return true;
 }
 function shrub(x,z,s=1){if(!inGround(x,z,2)||nearPath(x,z,1))return;instance('shrub',x,.9*s,z,2.8*s,1.6*s,2.5*s);details.shrubs++;}
 function flowers(cx,cz,rx,rz,color='flowerRose'){for(let i=0;i<45;i++){const a=random()*Math.PI*2,r=Math.sqrt(random());const x=cx+Math.cos(a)*rx*r,z=cz+Math.sin(a)*rz*r;if(!inGround(x,z,2)||nearPath(x,z,.5))continue;instance('grassBlade',x,.6,z,.18,1.2,.18);instance(color,x,.9+random()*.2,z,.65,.5,.65);details.flowers++;}}
 function bench(x,z,rotation=0){if(!inGround(x,z,2))return;for(let i=0;i<4;i++)instance('wood',x,.95,z+(i-1.5)*.28,4,.18,.22,rotation);for(const side of [-1,1])instance('metal',x+side*1.5,.45,z,.24,.9,1.1,rotation);instance('wood',x,1.6,z-.55,4,1.1,.18,rotation);details.benches++;}
 // Dense layered planting is grouped, leaving the avenue, facades and footpaths clear.
 const groves=[[-345,322,55,22,'pine'],[-170,320,49,22,'broad'],[100,324,51,20,'broad'],[380,335,130,13,'pine'],[-390,-325,25,26,'pine'],[-220,-330,68,20,'blossom'],[-520,-230,23,45,'light'],[555,210,25,75,'broad'],[330,285,65,36,'light'],[480,285,45,25,'blossom'],[-275,198,13,70,'broad'],[-180,225,35,12,'blossom'],[127,214,40,12,'blossom']];
 for(const [cx,cz,rx,rz,type] of groves){for(let i=0;i<55;i++){const x=cx+(random()-.5)*rx*2,z=cz+(random()-.5)*rz*2;tree(x,z,.65+random()*.65,type);if(i%2===0)shrub(x+4,z+3,.8+random()*.5);}}
 for(const path of gardenPaths){const c=new T.CatmullRomCurve3(path.points.map(([x,z])=>new T.Vector3(x,0,z)),false,'centripetal');const n=Math.floor(c.getLength()/11);for(let i=0;i<=n;i++){const t=i/n,p=c.getPointAt(t),v=c.getTangentAt(t);const side=i%2?1:-1;tree(p.x+v.z*side*8,p.z-v.x*side*8,.7+random()*.35,path.id.includes('north')||path.id.includes('water')?'blossom':'light');if(i%3===0)bench(p.x-v.z*5,p.z+v.x*5,Math.atan2(v.x,v.z));}}
 // Courtyard gardens: low planting, inset paving, trees and seating inside the open void.
 for(const b of [...buildings.filter(b=>b.kind==='court'),...teachingCourts.map(([x,z,w,d])=>({x:buildings.find(b=>b.id==='02').x+x,z:buildings.find(b=>b.id==='02').z+z,w,d}))]){const wing=Math.min(b.w,b.d)*.22,iw=b.w-2*wing-6,id=b.d-2*wing-6;
  instance('path',b.x,1.45,b.z,iw, .2,2.1);instance('path',b.x,1.45,b.z,2.1,.2,id);
  for(const side of [-1,1]){instance('shrub',b.x+side*iw*.27,1.9,b.z-id*.23,iw*.22,1.6,id*.24);instance('flowerGold',b.x+side*iw*.27,2.8,b.z-id*.23,iw*.19,.35,id*.19);instance('trunk',b.x+side*iw*.26,4.1,b.z+id*.2,.6,6,.6);for(let j=0;j<3;j++)instance('leafLight',b.x+side*iw*.26+Math.cos(j*2.1)*1.5,8,b.z+id*.2+Math.sin(j*2.1)*1.5,5,5,5);details.trees++;}
 }
 // Meadow clusters, reed beds and mixed borders use deterministic placement.
 for(let i=0;i<1700;i++){const x=(random()-.5)*1180,z=(random()-.5)*680;if(!inGround(x,z,4)||nearPath(x,z,3))continue;if(i%3===0)shrub(x,z,.55+random()*.7);else instance('groundCover',x,.35,z,1.3+random()*2,.55,1.1+random()*2);}
 for(let i=0;i<lakeOutline.length;i++){const a=lakeOutline[i],b=lakeOutline[(i+1)%lakeOutline.length];for(let j=0;j<8;j++){const t=j/8,x=T.MathUtils.lerp(a[0],b[0],t),z=T.MathUtils.lerp(a[1],b[1],t);if(blocked(x,z,3)||nearPath(x,z,2)||Math.abs(x)<25)continue;for(let k=0;k<4;k++)instance('reeds',x+(random()-.5)*3,1.4,z+(random()-.5)*3,.18,2+random(),.18);if(j%3===0)instance('stone',x,.75,z,2.3,1.2,1.6);}}
 for(const [x,z,rx,rz,color] of [[-143,80,7,9,'flowerRose'],[-205,176,9,5,'flowerWhite'],[113,207,14,5,'flowerRose'],[300,270,12,7,'flowerGold'],[487,290,10,8,'flowerRose'],[-211,-284,20,5,'flowerWhite']])flowers(x,z,rx,rz,color);
 // Small pavilions, gate lodges, canteen wings and cycle shelters are approximate accessory masses.
 function lowBuilding(x,z,w,d,h,kind='pavilion'){
  if(!insidePolygon(x,z,campusBoundary)||buildingBlocked(x,z,3)||waterMask(x,z))return;const g=new T.Group();g.position.set(x,0,z);world.add(g);
  box(g,0,.5,0,w+2,1,d+2,'pave');
  if(kind==='pavilion'){for(const a of [-1,1])for(const b of [-1,1])box(g,a*(w/2-1),h/2,b*(d/2-1),.5,h,.5,'wood');box(g,0,h,0,w+2,.55,d+2,'wood');for(let i=-w/2;i<w/2;i+=1.8)box(g,i,h+.45,0,.65,.4,d+2,'wood');box(g,0,1.1,-d/3,w*.8,.55,1.5,'wood');}
  else {box(g,0,h/2,0,w,h,d,'cladding');box(g,0,h+.3,0,w+1,.6,d+1,'rim');box(g,0,h+.7,0,w-2,.5,d-2,'roof');for(let dx=-w/2+2;dx<w/2;dx+=3.3)box(g,dx,h*.54,d/2+.15,2,h*.45,.25,'glass');box(g,0,2,d/2+.18,2.2,4,.3,'glass');box(g,0,4.3,d/2+1.3,w*.5,.35,3,'metal');}
  details.lowBuildings++;
 }
 for(const v of accessoryPlan)lowBuilding(...v);
 for(const b of buildings.filter(b=>b.kind==='canteen')){const g=new T.Group();g.position.set(b.x,0,b.z);world.add(g);const z=b.d/2+6;box(g,0,3.2,z,b.w*.8,6.4,10,'cladding');box(g,0,6.8,z,b.w*.85,.6,12,'rim');for(let x=-b.w*.35;x<b.w*.35;x+=4)box(g,x,3.5,z+5.1,2.5,3.8,.25,'glass');details.lowBuildings++;}
 // Covered bicycle parking: posts, a lightweight roof, rails and repeated bicycle silhouettes.
 for(const b of buildings.filter(b=>b.kind==='dorm')){const x=b.x,z=b.z+b.d/2+13;if(!insidePolygon(x,z,campusBoundary)||blocked(x,z,1)||waterMask(x,z))continue;instance('metal',x,3.5,z,b.w*.68,.35,4.6);for(const s of [-1,1])instance('metal',x+s*b.w*.29,1.7,z,.22,3.4,.22);for(let dx=-b.w*.27;dx<b.w*.28;dx+=2.8){instance('dark',x+dx,.85,z,.2,1.5,2);instance('metal',x+dx,1.4,z,.15,.2,1.7);}details.lowBuildings++;}
 // Merge all paths by material: vegetation count can grow without a draw call per plant.
 for(const [key,geometries] of Object.entries(merged))if(geometries.length){const geometry=mergeGeometries(geometries);const object=mesh(geometry,mat[key],0,0,0);object.castShadow=false;for(const g of geometries)g.dispose();}
 return {...details,pathSamples,plannedPaths:allPaths.length,canPlant:(x,z)=>inGround(x,z,5)&&!nearPath(x,z,3)};
}
