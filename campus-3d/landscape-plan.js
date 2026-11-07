// Display reconstruction from the supplied reference map, not a surveyed walking network.
export const campusBoundary=[[-450,-390],[490,-390],[690,390],[-685,390]];
export const centralRing=[[-160,-250],[-220,-185],[-235,0],[-255,140],[-150,230],[180,230],[245,165],[220,-175],[150,-240],[-160,-250]];
export const lakeOutline=[[-190,-185],[-162,-150],[-173,-82],[-195,-40],[-180,20],[-165,65],[-185,100],[-190,135],[-155,153],[-105,145],[-55,115],[-35,105],[25,110],[65,95],[118,75],[150,20],[174,42],[155,105],[170,145],[128,182],[62,177],[30,190],[-30,182],[-85,200],[-145,188],[-205,160],[-224,112],[-218,50],[-208,-20],[-218,-85],[-205,-145]];
export const mainCrossAxisZ=-65;
export const roadRoutes=[
 {points:[...campusBoundary,campusBoundary[0]],width:15},
 {points:[[0,-390],[0,-180]],width:24},{points:[[0,12],[0,390]],width:28},
 {points:[[-520,mainCrossAxisZ],[-230,mainCrossAxisZ]],width:15},{points:[[80,-65],[500,-65]],width:15},{points:[[-570,90],[-350,90],[-270,150]],width:14},
 {points:[[420,-370],[525,-170],[615,330]],width:15},
 {points:centralRing,width:12,material:'pave'},
 {points:[[-410,-245],[-315,-235],[-210,-190]],width:10},
 {points:[[150,-240],[305,-240],[420,-240]],width:10},
 {points:[[-410,-60],[-315,-60],[-230,-60]],width:9},
 {points:[[225,-65],[490,-65]],width:10},{points:[[230,135],[540,135]],width:9}
];
export function insidePolygon(x,z,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);}
export function routeDistance(x,z,routes){let best=Infinity;for(const route of routes)for(let i=1;i<route.points.length;i++)best=Math.min(best,segmentDistance(x,z,route.points[i-1],route.points[i]));return best;}

// Build one shared distance field. Entrance paths follow free ground to a main road,
// avoiding building envelopes and water. This is model detailing, not navigation data.
export function planFootpaths(buildings){
 const step=4,minX=-648,minZ=-372,cols=325,rows=186,count=cols*rows;
 const walkable=new Uint8Array(count),parent=new Int32Array(count).fill(-1),distance=new Int32Array(count).fill(-1),queue=new Int32Array(count);let head=0,tail=0;
 const rects=buildings.filter(b=>!['gate'].includes(b.kind));
 const point=(index)=>[minX+(index%cols)*step,minZ+Math.floor(index/cols)*step];
 const indexAt=([x,z])=>Math.round((z-minZ)/step)*cols+Math.round((x-minX)/step);
 for(let i=0;i<count;i++){const [x,z]=point(i);if(!insidePolygon(x,z,campusBoundary)||insidePolygon(x,z,lakeOutline)||rects.some(b=>Math.abs(x-b.x)<b.w/2+3&&Math.abs(z-b.z)<b.d/2+3))continue;walkable[i]=1;
  if(roadRoutes.some(r=>{for(let j=1;j<r.points.length;j++)if(segmentDistance(x,z,r.points[j-1],r.points[j])<r.width/2-1)return true;return false;})){distance[i]=0;queue[tail++]=i;}
 }
 while(head<tail){const i=queue[head++],cx=i%cols;for(const n of [cx>0?i-1:-1,cx<cols-1?i+1:-1,i-cols,i+cols]){if(n<0||n>=count||!walkable[n]||distance[n]>=0)continue;distance[n]=distance[i]+1;parent[n]=i;queue[tail++]=n;}}
 const paths=[];
 for(const b of buildings){if(['gate','field','library','teaching'].includes(b.kind))continue;
  const starts=[[b.x,b.z+b.d/2+7],[b.x,b.z-b.d/2-7],[b.x-b.w/2-7,b.z],[b.x+b.w/2+7,b.z]];
  // Two approaches per block; no generated path is allowed to cut through another block.
  const options=starts.map(p=>({p,i:indexAt(p)})).filter(o=>o.i>=0&&o.i<count&&walkable[o.i]&&distance[o.i]>=0).sort((a,b)=>distance[a.i]-distance[b.i]);
  for(const option of options.slice(0,b.kind==='dorm'?1:2)){const points=[];let i=option.i;while(i>=0){points.push(point(i));i=parent[i];}if(points.length<2)continue;
   const simple=[points[0]];for(let j=1;j<points.length-1;j++){const a=points[j-1],p=points[j],c=points[j+1];if((p[0]-a[0])*(c[1]-p[1])!==(p[1]-a[1])*(c[0]-p[0]))simple.push(p);}simple.push(points.at(-1));
   paths.push({id:`entrance-${b.id}-${paths.length}`,buildingId:b.id,points:simple,width:b.kind==='dorm'?2.7:3.4});
  }
 }
 return paths;
}

export const gardenPaths=[
 {id:'water-west',points:[[-161,-156],[-145,-130],[-151,-90],[-163,-58],[-150,-18],[-143,20],[-139,66],[-151,91]],width:3},
 {id:'water-west-south',points:[[-229,35],[-238,65],[-231,104],[-218,145],[-187,171],[-141,211],[-93,215]],width:3.8},
 {id:'water-south',points:[[-135,213],[-91,222],[-45,218],[-19,221],[0,230],[72,215],[113,203],[158,207],[185,223]],width:3.5},
 {id:'east-culture',points:[[217,-42],[219,-2],[226,34],[228,90],[242,125],[230,177],[212,204],[181,229]],width:3},
 {id:'east-meadow',points:[[240,200],[275,212],[318,223],[380,227],[438,230],[500,226],[550,257],[549,302],[490,320],[420,315],[355,310],[289,301],[241,282],[218,249],[240,200]],width:3.6},
 {id:'meadow-cross',points:[[273,212],[295,250],[355,265],[416,280],[490,320]],width:2.5},
 {id:'north-garden',points:[[-260,-272],[-220,-295],[-170,-300],[-115,-305],[-75,-320],[-42,-340],[0,-345]],width:3.2},
 {id:'sports-walk',points:[[-408,333],[-365,330],[-311,313],[-289,283],[-281,235],[-281,190],[-278,144],[-298,109],[-360,99],[-400,111]],width:3.8},
 {id:'west-residential',points:[[-542,50],[-557,9],[-542,-48],[-511,-90],[-492,-138],[-490,-202],[-445,-238]],width:3},
 {id:'east-residential',points:[[503,-198],[516,-146],[528,-89],[535,-25],[554,32],[563,94],[557,161],[543,192]],width:3}
];
