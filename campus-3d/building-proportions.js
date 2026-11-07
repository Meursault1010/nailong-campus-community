// Shared by the rendered model, land mask and courtyard planting.
// Display-scale calibration, not surveyed dimensions.
export const teachingCourts=[[0,-45,130,44],[-70,-15,44,72],[-70,50,44,44]];
export const teachingLinks=[[-38,-43,20,8,14],[-70,23,12,14,14]];
export function teachingFootprints(b){return [...teachingCourts,...teachingLinks].map(([x,z,w,d])=>({x:b.x+x,z:b.z+z,w,d}));}
