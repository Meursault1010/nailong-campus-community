<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { createCampus } from '../../campus-3d/model.js';
import { buildings } from '../../campus-3d/data.js';

const emit=defineEmits(['place','place-fallback','user','role']);
const props=defineProps({users:{type:Array,default:()=>[]},player:{type:Object,default:()=>({})},controlMode:{type:Boolean,default:false}});
const host=ref(null),mapFailed=ref(false);let campus;const knownUsers=new Set();
const fallbackBuildings=computed(()=>buildings.filter(building=>['01','02','03','05','08','10','19','31','42','S'].includes(building.id)));
function fallbackPosition(x,z){return {left:`${(x+700)/1400*100}%`,top:`${(z+420)/850*100}%`}}
const avatarFilters={sunshine:'none',lagoon:'hue-rotate(155deg) saturate(.82)',mint:'hue-rotate(95deg) saturate(.7)',peach:'hue-rotate(325deg) saturate(.78)'};
function syncUsers(){if(!campus)return;const activeIds=new Set();props.users.forEach(user=>{const id=`demo-user-${user.name}`;activeIds.add(id);if(!knownUsers.has(id)){campus.addMascot(id,{x:user.x,z:user.z,color:user.color,name:user.name,filter:avatarFilters[user.avatarTone]||'none',socialState:user.socialState,onClick:()=>emit('user',user)});knownUsers.add(id)}campus.showMascot(id,true)});knownUsers.forEach(id=>{if(!activeIds.has(id))campus.showMascot(id,false)})}
function syncPlayer(){if(!campus)return;campus.setPlayer({x:props.player.x,z:props.player.z,name:props.player.name,color:props.player.color||'#d8b85d',filter:avatarFilters[props.player.avatarTone]||'none',onClick:()=>{if(props.controlMode)campus?.selectPlayer();else emit('role',{type:'playerClicked'});}});}
function startCampus(){
 try{
  mapFailed.value=false;
  campus=createCampus(host.value,b=>emit('place',b),()=>{},event=>emit('role',event));
  syncUsers();
  syncPlayer();
  campus.setControlMode(props.controlMode);
 }catch(error){console.error(error);mapFailed.value=true;}
}
function retryMap(){campus?.dispose();campus=undefined;knownUsers.clear();mapFailed.value=false;nextTick(startCampus)}
onMounted(startCampus);
watch(()=>props.users,syncUsers);
watch(()=>props.player,syncPlayer,{deep:true});
watch(()=>props.controlMode,value=>campus?.setControlMode(value));
onUnmounted(()=>campus?.dispose());
function reset(){campus?.setView('overview')}
function focus(x,z){campus?.focusAt(x,z)}
function panBy(x,z){campus?.panBy(x,z)}
function movePlayer(x,z){return campus?.movePlayerTo(x,z)}
function enterBuilding(id){return campus?.enterBuilding(id)}
function exitBuilding(){return campus?.exitBuilding()}
function stopPlayer(){campus?.stopPlayer()}
function selectPlayer(){campus?.selectPlayer()}
defineExpose({reset,focus,panBy,movePlayer,enterBuilding,exitBuilding,stopPlayer,selectPlayer,setControlMode:value=>campus?.setControlMode(value)});
</script>
<template><div ref="host" class="campus-scene-host" tabindex="0" aria-label="河海大学常州校区金坛长荡湖校址三维示意模型，位置比例为近似"><div v-if="mapFailed" class="campus-fallback" role="region" aria-label="校园地点简化视图"><header><div><b>三维地图暂不可用</b><span>以下地点目录可继续查看建筑资料；移动与进楼需恢复三维地图。</span></div><button @click="retryMap">重试三维地图</button></header><div class="fallback-stage"><div class="fallback-plan"><svg viewBox="0 0 1000 607" preserveAspectRatio="none" aria-hidden="true"><path d="M180 20 820 20 980 560 30 560Z" class="fallback-boundary"/><path d="M500 20V275M500 355V585M30 280H420M580 280H980" class="fallback-road"/><path d="M360 190 390 255 365 310 420 380 500 405 600 355 660 315 620 250 560 220 500 245Z" class="fallback-water"/></svg><button v-for="building in fallbackBuildings" :key="building.id" class="fallback-building" :style="fallbackPosition(building.x,building.z)" @click="emit('place-fallback',building)">{{building.id==='S'?'南门':building.id==='01'?'图书馆':building.id==='02'?'公共教学楼':building.id==='10'?'体育场':building.name}}</button><span class="fallback-player" :style="fallbackPosition(props.player.x||0,props.player.z||0)" aria-label="我的奶龙位置"><img src="/nailong-avatar.png" :style="{filter:avatarFilters[props.player.avatarTone]||'none'}" alt=""></span></div></div><details class="fallback-directory"><summary>打开地点目录（{{buildings.length}} 处）</summary><div><button v-for="building in buildings" :key="building.id" @click="emit('place-fallback',building)">{{building.id}} · {{building.name}}</button></div></details></div><template v-else><div id="labels"></div><div id="loading">正在载入校园三维模型…</div><div class="embedded-compass"><span>北 N</span><b id="north-arrow">▲</b></div><div class="embedded-tools"><button aria-label="重置视点" title="重置视点" @click="reset"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg></button><button aria-label="移动视点" title="移动视点" @click="campus?.pan()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M12 3l-3 3m3-3 3 3M12 21l-3-3m3 3 3-3M3 12l3-3m-3 3 3 3m12-3-3-3m3 3-3 3"/></svg></button><button aria-label="开始校园导览" title="开始校园导览" @click="campus?.tour()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg></button><button v-if="controlMode" aria-label="停止角色移动" title="停止角色移动" @click="stopPlayer"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg></button></div></template></div></template>
