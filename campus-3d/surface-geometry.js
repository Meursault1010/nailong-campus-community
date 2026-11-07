import {mainCrossAxisZ} from './landscape-plan.js';
import {CircleGeometry, RingGeometry} from 'three';

// Adjacent regions share their boundary vertices; no hidden full discs below the pitch.
export function stadiumSurfaces(width,depth){
 return [[.92,1,'pave'],[.7,.92,'track'],[0,.7,'green']].map(([inner,outer,material])=>{
  const geometry=inner?new RingGeometry(inner,outer,96):new CircleGeometry(outer,96);
  geometry.rotateX(-Math.PI/2);geometry.scale(width/2,1,depth/2);geometry.translate(0,1.1,0);
  return {geometry,material};
 });
}

// Deck bottoms clear the highest water/shore layer (0.55); tops clear adjoining paving.
export const bridges=[
 {x:0,z:148,width:36,length:110,bottom:1.35,thickness:.9,axis:'z'},
 {id:'west-main',x:-196,z:mainCrossAxisZ,width:15,length:68,bottom:1.35,thickness:.9,axis:'x'},
 {x:-48,z:390,width:17,length:72,bottom:1.35,thickness:.9,axis:'x'}
];
