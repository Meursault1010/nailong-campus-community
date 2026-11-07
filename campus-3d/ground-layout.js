import {teachingFootprints} from './building-proportions.js';
import {Shape,ShapeGeometry,BufferGeometry,Float32BufferAttribute} from 'three';

export function buildingLand(buildings){return buildings.flatMap(b=>b.kind==='teaching'?teachingFootprints(b):[{x:b.x,z:b.z,w:b.w,d:b.d}]).map(b=>({...b,w:b.w+8,d:b.d+8}));}
function half(poly,axis,value,sign){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-value)*sign,db=(b[axis]-value)*sign;if(da>=-1e-8)result.push(a);if((da>0&&db<0)||(da<0&&db>0)){const t=da/(da-db);result.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return result;}
// Split each triangle against the four rectangle boundaries. Keep only the outside pieces.
export function dryWaterGeometry(outline,land,y=.55){const shape=new Shape();outline.forEach(([x,z],i)=>i?shape.lineTo(x,z):shape.moveTo(x,z));shape.closePath();const source=new ShapeGeometry(shape);const p=source.attributes.position,index=source.index;let pieces=[];
 for(let i=0;i<index.count;i+=3)pieces.push([0,1,2].map(j=>[p.getX(index.getX(i+j)),p.getY(index.getX(i+j))]));source.dispose();
 for(const b of land){const next=[];for(const triangle of pieces){let inner=triangle;for(const [axis,value,sign] of [[0,b.x-b.w/2,1],[0,b.x+b.w/2,-1],[1,b.z-b.d/2,1],[1,b.z+b.d/2,-1]]){if(inner.length<3)break;const outer=half(inner,axis,value,-sign);if(outer.length>=3)next.push(outer);inner=half(inner,axis,value,sign);}}pieces=next;}
 const vertices=[],uv=[];for(const poly of pieces)for(let i=1;i<poly.length-1;i++){const tri=[poly[0],poly[i],poly[i+1]];const area=(tri[1][0]-tri[0][0])*(tri[2][1]-tri[0][1])-(tri[1][1]-tri[0][1])*(tri[2][0]-tri[0][0]);if(Math.abs(area)<1e-7)continue;if(area>0)tri.reverse();for(const [x,z] of tri){vertices.push(x,y,z);uv.push(x,z);}}
 const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new Float32BufferAttribute(uv,2));geometry.computeVertexNormals();return geometry;
}

export function dormLanes(buildings){const dorms=buildings.filter(b=>b.kind==='dorm'),result=[];for(let i=0;i<dorms.length;i++)for(let j=i+1;j<dorms.length;j++){const a=dorms[i],b=dorms[j],overlap=Math.min(a.x+a.w/2,b.x+b.w/2)-Math.max(a.x-a.w/2,b.x-b.w/2),gap=Math.abs(a.z-b.z)-(a.d+b.d)/2;if(overlap<16||gap<8||gap>48)continue;const z=(a.z+b.z)/2,x1=Math.min(a.x-a.w/2,b.x-b.w/2)-4,x2=Math.max(a.x+a.w/2,b.x+b.w/2)+4;
 if(buildings.some(c=>c!==a&&c!==b&&Math.abs(c.z-z)<c.d/2+3&&c.x+c.w/2>x1&&c.x-c.w/2<x2))continue;
 result.push({id:`dorm-${a.id}-${b.id}`,name:`${a.id}／${b.id}号楼间路`,points:[[x1,z],[x2,z]],width:4,anchor:[(x1+x2)/2,z]});}return result;}
