import {Vector3} from 'three';

// Small facade parts share GPU instance batches; local placement also works in courtyard wings.
export function architectureDetail({instance}){
 function part(g,key,x,y,z,w,h,d,ry=0){const p=g.localToWorld(new Vector3(x,y,z));instance(key,p.x,p.y,p.z,w,h,d,ry);}
 function skin(g,x,z,w,d,h,floor){
  const floors=Math.max(1,Math.floor(h/floor));
  for(let f=0;f<floors;f++){
   const y=3+f*floor;
   for(const side of [-1,1])for(let axis=0;axis<2;axis++){
    const span=axis?d:w,edge=(axis?w:d)/2;
    for(let u=-span/2+3;u<span/2-1;u+=4.5){
     const px=x+(axis?side*(edge+.27):u),pz=z+(axis?u:side*(edge+.27));
     const add=(key,dx,dy,dz,a,b,c)=>part(g,key,px+dx,y+dy,pz+dz,a,b,c);
     // Three-dimensional reveals, split panes and projecting stone sills.
     for(const s of [-1,1])add('frame',axis?0:s*1.42,0,axis?s*1.42:0,axis?.34:.18,2.45,axis?.18:.34);
     for(const s of [-1,1])add('frame',0,s*1.13,0,axis?.34:3.02,.18,axis?3.02:.34);
     add('mullion',0,0,0,axis?.38:.08,2.05,axis?.08:.38);
     add('stone',axis?side*.18:0,-1.32,axis?0:side*.18,axis?.85:3.25,.22,axis?3.25:.85);
     if(f>0)add('stone',axis?side*.25:0,1.55,axis?0:side*.25,axis?1.1:3.3,.16,axis?3.3:1.1);
    }
   }
  }
  // Roof edge is a raised frame with a darker inset, rather than a plain cap.
  for(const side of [-1,1]){
   part(g,'stone',x,h+1.5,z+side*(d/2-.35),w,1.6,.65);
   part(g,'stone',x+side*(w/2-.35),h+1.5,z,.65,1.6,d);
   part(g,'mullion',x,h+2.36,z+side*(d/2-.35),w+.25,.14,.8);
  }
  if(w>19&&d>9){
   part(g,'stone',x+w*.24,h+1.65,z,6,2.2,4);
   for(let i=0;i<4;i++)part(g,'mullion',x+w*.24-2.3+i*1.5,h+2.84,z,.15,.18,3.3);
   part(g,'glass',x-w*.2,h+1.38,z,Math.min(9,w*.25),.45,Math.min(3,d*.25));
  }
 }
 function identity(g,b){
  const {w,d,h}=b;
  if(b.kind==='dorm'){
   // Recessed-looking balcony bays, light balustrades and a glazed stair core.
   for(let f=1;f<6;f++)for(let x=-w/2+5;x<w/2-3;x+=4.5){
    const y=3+f*4.3;
    part(g,'stone',x,y-1.5,d/2+.85,3.7,.25,1.8);
    part(g,'balcony',x,y-.7,d/2+1.66,3.6,1.2,.16);
    part(g,'mullion',x,y-.04,d/2+1.7,3.8,.1,.18);
    for(const s of [-1,1])part(g,'frame',x+s*1.8,y-.75,d/2+.85,.12,1.4,1.8);
   }
   part(g,'glass',w/2+.22,h/2,0,.28,h-2,4.1);
   for(let y=4;y<h;y+=4.3)part(g,'stone',w/2+.48,y,0,.65,.25,4.6);
   part(g,'stone',0,4.8,d/2+1.2,10,.45,3);
   for(const s of [-1,1])part(g,'mullion',s*4.4,2.4,d/2+2,.22,4.6,.22);
  }else if(['court','teaching','block','tower','canteen'].includes(b.kind)){
   const width=Math.min(w*.28,13),depth=b.kind==='court'?Math.min(w,d)*.22:d;
   // A taller central portal breaks the repeated classroom facade rhythm.
   part(g,'glass',0,4.5,d/2+.25,width,7,.32);
   for(const s of [-1,1])part(g,'stone',s*(width/2+.45),4.8,d/2+.5,.8,8.6,.9);
   for(let i=-1;i<=1;i++)part(g,'mullion',i*width/3,4.5,d/2+.48,.16,7,.18);
   part(g,'stone',0,8.9,d/2+.5,width+2,.55,1.1);
   part(g,'metal',0,4.7,d/2+1.6,width+3,.3,3.4);
   part(g,'glass',0,4.95,d/2+1.6,width+1,.12,2.7);
   for(const s of [-1,1])part(g,'mullion',s*(width/2+.6),2.3,d/2+2.7,.22,4.6,.22);
   for(let j=0;j<3;j++)part(g,'pave',0,.35+j*.17,d/2+1.1-j*.3,width+3-j*.7,.3,2.4-j*.5);
   if(b.kind==='court'){
    // Glazed corner circulation bay and a stepped crown distinguish the solid wings.
    const coreX=w/2-3.2;
    part(g,'glass',coreX,h*.56,d/2+.24,4.3,h*.78,.3);
    for(const s of [-1,1])part(g,'stone',coreX+s*2.3,h*.56,d/2+.52,.35,h*.85,.85);
    for(let y=3;y<h*.95;y+=3.9)part(g,'mullion',coreX,y,d/2+.47,4.5,.16,.32);
    part(g,'stone',coreX,h+1.8,d/2-2.5,5.7,1.8,5.5);
    part(g,'mullion',coreX,h+2.8,d/2-2.5,6,.18,5.8);
    // Courtyard colonnade and an inset timber-tone pergola remain within the footprint.
    for(let x=-w*.2;x<=w*.2;x+=4.5){
     part(g,'stone',x,2.1,d/2-depth-1,.4,4.2,.4);
     part(g,'timber',x,4.4,d/2-depth-2,.25,.3,3.2);
    }
    part(g,'stone',0,4.2,d/2-depth-1,w*.46,.35,.5);
   }
   for(const s of [-1,1])for(let i=0;i<3;i++)part(g,'stone',s*(w/2-1.3-i*.65),h*.55,-d/2-.48,.22,h*.72,.85);
  }
  if(b.kind==='arena'){
   for(let i=0;i<40;i++){
    const a=i/40*Math.PI*2;
    part(g,'stone',Math.cos(a)*w*.502,h/2,Math.sin(a)*d*.502,.5,h,.65,-a);
   }
   part(g,'metal',0,4.8,d/2+1.5,w*.3,.4,3.5);
  }
 }
 return {skin,identity};
}
