import { createServer } from 'node:http';
import { mkdirSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.CAMPUS_DATA_DIR || path.join(root, 'data'));
mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(path.join(dataDir, 'campus.sqlite'));
const dev = process.argv.includes('--dev');
const preview = process.argv.includes('--preview');
const apiPort = Number(process.env.API_PORT || (dev ? 5180 : (process.env.PORT || 5179)));
const host = process.env.HOST || '127.0.0.1';
const viteHost = process.env.VITE_HOST || host;
const clients = new Set();
let viteProcess;

db.exec(`
 PRAGMA journal_mode = WAL;
 PRAGMA foreign_keys = ON;
 CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, avatar_tone TEXT NOT NULL DEFAULT 'sunshine',
  faculty TEXT NOT NULL DEFAULT '未选择院系', year TEXT NOT NULL DEFAULT '演示用户',
  bio TEXT NOT NULL DEFAULT '', interests TEXT NOT NULL DEFAULT '', social_state TEXT NOT NULL DEFAULT 'active',
  visibility TEXT NOT NULL DEFAULT 'campus', x REAL NOT NULL DEFAULT 0, z REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT '刚刚来到校园', area TEXT NOT NULL DEFAULT '中心水景', is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, last_seen TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, author_id TEXT NOT NULL REFERENCES users(id), type TEXT NOT NULL,
  text TEXT NOT NULL, likes INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, PRIMARY KEY(post_id,user_id)
 );
 CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY, seller_id TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', tag TEXT NOT NULL, price REAL NOT NULL,
  place TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'available', color TEXT NOT NULL, created_at TEXT NOT NULL
 );
 CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, sender_id TEXT NOT NULL REFERENCES users(id), recipient_id TEXT NOT NULL REFERENCES users(id),
  text TEXT NOT NULL, created_at TEXT NOT NULL
 );
 CREATE INDEX IF NOT EXISTS posts_created_idx ON posts(created_at DESC);
 CREATE INDEX IF NOT EXISTS comments_post_idx ON comments(post_id,created_at);
 CREATE INDEX IF NOT EXISTS messages_pair_idx ON messages(sender_id,recipient_id,created_at);
`);

const now = () => new Date().toISOString();
const tones = new Set(['sunshine', 'lagoon', 'mint', 'peach']);
const postTypes = new Set(['校园消息', '生活分享', '学习搭子', '失物招领', '活动招募']);
const marketColors = { '学习用品': '#d9e9df', '教材资料': '#d9e4ed', '生活好物': '#e9dfcf', '运动户外': '#e6e7d5' };

function seed() {
 const createUser = db.prepare(`INSERT OR IGNORE INTO users
  (id,display_name,avatar_tone,faculty,year,bio,interests,social_state,visibility,x,z,status,area,is_demo,created_at,last_seen)
  VALUES (@id,@name,@tone,@faculty,'演示本科生',@bio,@interests,'active','campus',@x,@z,@status,@area,1,@now,@now)`);
 const demoUsers = [
  ['demo-orange','一颗小橘子','peach','材料科学与工程学院','喜欢傍晚的湖边和橘子汽水。','散步、音乐、摄影',-65,-100,'公共教学楼研讨中','东侧教学区'],
  ['demo-blueberry','蓝莓奶龙','lagoon','信息科学与工程学院','正在寻找一起自习和打球的伙伴。','编程、羽毛球、桌游',0,-45,'图书馆自习中','中心水景'],
  ['demo-ricecake','米糕同学','mint','经济与金融学院','校园美食探索中，欢迎推荐食堂窗口。','美食、跑步、电影',-430,-35,'一食堂用餐中','西侧生活区'],
  ['demo-yuzu','柚子汽水','sunshine','新能源学院','喜欢在操场吹晚风，也爱拍校园植物。','慢跑、摄影、植物',-500,225,'体育场慢跑','体育场'],
  ['demo-cloud','云朵同学','peach','人工智能与自动化学院','刚从宿舍出发，正在找午饭搭子。','美食、手帐、散步',455,-110,'宿舍区附近','东侧生活区']
 ];
 for (const [id,name,tone,faculty,bio,interests,x,z,status,area] of demoUsers) createUser.run({ id,name,tone,faculty,bio,interests,x,z,status,area,now:now() });
 const postCount = db.prepare('SELECT COUNT(*) AS n FROM posts').get().n;
 if (postCount === 0) {
  const addPost = db.prepare('INSERT INTO posts(id,author_id,type,text,likes,created_at) VALUES(?,?,?,?,?,?)');
  const addComment = db.prepare('INSERT INTO comments(id,post_id,author_id,text,created_at) VALUES(?,?,?,?,?)');
  const samples = [
   ['post-water','demo-orange','校园消息','早上湖边的风很舒服，东侧步道的树叶已经有一点秋天的颜色了。路过的同学可以慢慢走一段。',18,'今天 08:42',[['demo-blueberry','谢谢分享，傍晚也去看看。']]],
   ['post-book','demo-blueberry','学习搭子','想找两位同学这周一起去图书馆复习水力学，计划每次专注一小时，中间休息十分钟。',9,'昨天 20:16',[['demo-ricecake','周四下午可以一起！']]],
   ['post-food','demo-ricecake','生活分享','最近在做食堂窗口记录，欢迎推荐你觉得值得再吃一次的菜～我先投一票番茄鸡蛋面。',12,'昨天 12:05',[]],
   ['post-found','demo-yuzu','失物招领','在体育场看台附近捡到一只蓝色水杯，已交给场馆服务台。失主可以去询问。',6,'周一 17:38',[]],
   ['post-activity','demo-cloud','活动招募','校园原型活动招募：想找几位同学傍晚一起轻松跑步，集合地点和路线以地图示意为准，随时可以退出。',4,'今天 08:10',[]]
  ];
  for (const [id,user,type,text,likes,time,comments] of samples) {
   addPost.run(id,user,type,text,likes,now());
   for (const [author,comment] of comments) addComment.run(randomUUID(),id,author,comment,now());
  }
 }
 if (db.prepare('SELECT COUNT(*) AS n FROM listings').get().n === 0) {
  const addListing = db.prepare('INSERT INTO listings(id,seller_id,title,description,tag,price,place,color,created_at) VALUES(?,?,?,?,?,?,?,?,?)');
  [
   ['list-ruler','demo-orange','九成新｜工程制图尺套装','尺套装齐全，保存较好。','学习用品',18,'东区宿舍 · 当面交接'],
   ['list-fan','demo-ricecake','出一把宿舍小风扇','功能正常，约在食堂附近交接。','生活好物',25,'约在一食堂门口'],
   ['list-hydro','demo-blueberry','《水力学》课本与笔记','附课程笔记，适合复习使用。','教材资料',32,'图书馆北门交接']
  ].forEach(([id,user,title,description,tag,price,place]) => addListing.run(id,user,title,description,tag,price,place,marketColors[tag]||'#e7e9df',now()));
 }
}
seed();

const hashToken = token => createHash('sha256').update(token).digest('hex');
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim().split('=').map(decodeURIComponent)).filter(pair => pair.length === 2)); }
function sessionUser(req) {
 const token = cookies(req).campus_session;
 if (!token) return null;
 const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?`).get(hashToken(token), now());
 if (row) db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), row.id);
 return row || null;
}
function publicUser(user, selfId = null) {
 const colors={sunshine:'#d8b85d',lagoon:'#6e9bbc',mint:'#a6b891',peach:'#d99d7e'};return { id:user.id,name:user.display_name,avatarTone:user.avatar_tone,faculty:user.faculty,year:user.year,bio:user.bio,interests:user.interests,socialState:user.social_state,visibility:user.visibility,x:user.x,z:user.z,status:user.status,area:user.area,color:colors[user.avatar_tone]||'#d8b85d',online:Date.now()-Date.parse(user.last_seen)<45000,isMe:user.id===selfId };
}
function displayTime(value){const date=new Date(value),format=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}),stamp=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date),today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),diff=(Date.parse(`${today}T00:00:00Z`)-Date.parse(`${stamp}T00:00:00Z`))/86400000;return diff===0?`今天 ${format.format(date)}`:diff===1?`昨天 ${format.format(date)}`:diff<7?`${diff}天前 ${format.format(date)}`:stamp}
function sendJson(res, status, data, headers = {}) { res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', ...headers }); res.end(JSON.stringify(data)); }
function fail(res,status,error){sendJson(res,status,{error})}
async function readBody(req, limit=65536) {
 let raw=''; for await (const chunk of req) { raw += chunk; if(raw.length>limit) throw Object.assign(new Error('请求内容过大'),{status:413}); }
 if(!raw)return {}; try{return JSON.parse(raw)}catch{throw Object.assign(new Error('请求格式无效'),{status:400})}
}
function textField(value,max,label){if(typeof value!=='string')throw Object.assign(new Error(`${label}格式无效`),{status:400});const cleaned=value.trim();if(!cleaned||cleaned.length>max)throw Object.assign(new Error(`${label}长度须为 1–${max} 个字符`),{status:400});return cleaned}
function publish(type,payload,audience=null){const packet=`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`;for(const client of clients){if(audience&&!audience.includes(client.userId))continue;try{client.res.write(packet)}catch{clients.delete(client)}}}
function getPosts(userId){
 const posts=db.prepare(`SELECT p.*,u.display_name,u.avatar_tone FROM posts p JOIN users u ON u.id=p.author_id ORDER BY p.created_at DESC`).all();
 const comments=db.prepare(`SELECT c.*,u.display_name FROM comments c JOIN users u ON u.id=c.author_id ORDER BY c.created_at`).all();
 const likes=db.prepare('SELECT 1 AS liked FROM post_likes WHERE post_id=? AND user_id=?');
 return posts.map(post=>({id:post.id,author:post.display_name,tone:post.avatar_tone,type:post.type,time:displayTime(post.created_at),text:post.text,likes:post.likes,liked:!!(userId&&likes.get(post.id,userId)),comments:comments.filter(c=>c.post_id===post.id).map(c=>({author:c.display_name,text:c.text,createdAt:c.created_at}))}));
}
function getListings(){return db.prepare(`SELECT l.*,u.display_name,u.avatar_tone FROM listings l JOIN users u ON u.id=l.seller_id WHERE l.status='available' ORDER BY l.created_at DESC`).all().map(row=>({id:row.id,title:row.title,description:row.description,tag:row.tag,price:`¥ ${row.price}`,amount:row.price,seller:row.display_name,sellerId:row.seller_id,sellerTone:row.avatar_tone,place:row.place,color:row.color,status:row.status,createdAt:row.created_at}));}

const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');const method=req.method||'GET';
  if(url.pathname.startsWith('/api/')){
   if(method==='GET'&&url.pathname==='/api/health')return sendJson(res,200,{ok:true,service:'nailong-campus-api',database:'sqlite',time:now()});
   if(method==='POST'&&url.pathname==='/api/auth/demo'){
    const body=await readBody(req),name=textField(body.name,20,'昵称');const id=randomUUID(),stamp=now();
    const user={id,name,tone:tones.has(body.avatarTone)?body.avatarTone:'sunshine',faculty:typeof body.faculty==='string'?body.faculty.slice(0,60):'未选择院系',year:typeof body.year==='string'?body.year.slice(0,30):'演示用户',bio:typeof body.bio==='string'?body.bio.slice(0,120):'',interests:typeof body.interests==='string'?body.interests.slice(0,80):'',socialState:['active','low'].includes(body.socialState)?body.socialState:'active',visibility:body.visibility==='private'?'private':'campus',x:Number.isFinite(body.x)?body.x:0,z:Number.isFinite(body.z)?body.z:0,status:'刚刚来到校园',area:'校园入口',createdAt:stamp};
    db.prepare(`INSERT INTO users(id,display_name,avatar_tone,faculty,year,bio,interests,social_state,visibility,x,z,status,area,is_demo,created_at,last_seen) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?)`).run(user.id,user.name,user.tone,user.faculty,user.year,user.bio,user.interests,user.socialState,user.visibility,user.x,user.z,user.status,user.area,stamp,stamp);
    const token=randomBytes(32).toString('base64url');db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').run(hashToken(token),id,new Date(Date.now()+30*864e5).toISOString(),stamp);
    publish('presence',{user:publicUser({...user,display_name:name,avatar_tone:user.tone,social_state:user.socialState,last_seen:stamp})});
    return sendJson(res,201,{user:publicUser({...user,display_name:name,avatar_tone:user.tone,social_state:user.socialState,last_seen:stamp},id)},{'Set-Cookie':`campus_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${req.socket.encrypted?'; Secure':''}`});
   }
   if(method==='GET'&&url.pathname==='/api/auth/me'){const user=sessionUser(req);return sendJson(res,200,{user:user?publicUser(user,user.id):null});}
   if(method==='POST'&&url.pathname==='/api/auth/logout'){const token=cookies(req).campus_session;if(token)db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));return sendJson(res,200,{ok:true},{'Set-Cookie':'campus_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'});}
   if(method==='GET'&&url.pathname==='/api/community/posts')return sendJson(res,200,{posts:getPosts(sessionUser(req)?.id)});
   if(method==='POST'&&url.pathname==='/api/community/posts'){
    const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');const body=await readBody(req),text=textField(body.text,300,'动态内容'),type=postTypes.has(body.type)?body.type:'生活分享',id=randomUUID(),stamp=now();
    db.prepare('INSERT INTO posts(id,author_id,type,text,created_at) VALUES(?,?,?,?,?)').run(id,user.id,type,text,stamp);const post=getPosts(user.id).find(item=>item.id===id);publish('post-created',{post});return sendJson(res,201,{post});
   }
   let match=url.pathname.match(/^\/api\/community\/posts\/([^/]+)\/(comments|likes)$/);
   if(match){const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');const id=decodeURIComponent(match[1]);if(!db.prepare('SELECT id FROM posts WHERE id=?').get(id))return fail(res,404,'动态不存在');
    if(match[2]==='comments'&&method==='POST'){const body=await readBody(req),text=textField(body.text,120,'评论'),commentId=randomUUID(),stamp=now();db.prepare('INSERT INTO comments(id,post_id,author_id,text,created_at) VALUES(?,?,?,?,?)').run(commentId,id,user.id,text,stamp);const comment={id:commentId,author:user.display_name,text,createdAt:stamp};publish('comment-created',{postId:id,comment});return sendJson(res,201,{comment});}
    if(match[2]==='likes'&&method==='POST'){const current=db.prepare('SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?').get(id,user.id);let liked;if(current){db.prepare('DELETE FROM post_likes WHERE post_id=? AND user_id=?').run(id,user.id);db.prepare('UPDATE posts SET likes=MAX(0,likes-1) WHERE id=?').run(id);liked=false}else{db.prepare('INSERT INTO post_likes(post_id,user_id,created_at) VALUES(?,?,?)').run(id,user.id,now());db.prepare('UPDATE posts SET likes=likes+1 WHERE id=?').run(id);liked=true}const likes=db.prepare('SELECT likes FROM posts WHERE id=?').get(id).likes;publish('like-updated',{postId:id,likes});return sendJson(res,200,{liked,likes});}
   }
   if(method==='GET'&&url.pathname==='/api/market/items')return sendJson(res,200,{items:getListings()});
   if(method==='POST'&&url.pathname==='/api/market/items'){
    const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');const body=await readBody(req),title=textField(body.title,80,'商品标题'),tag=Object.hasOwn(marketColors,body.tag)?body.tag:'生活好物',price=Number(body.price);if(!Number.isFinite(price)||price<0||price>100000)return fail(res,400,'请输入有效价格');const place=textField(body.place,100,'交接地点'),description=typeof body.description==='string'?body.description.trim().slice(0,500):'',id=randomUUID(),stamp=now();db.prepare('INSERT INTO listings(id,seller_id,title,description,tag,price,place,color,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,user.id,title,description,tag,price,place,marketColors[tag],stamp);const item=getListings().find(listing=>listing.id===id);publish('listing-created',{item});return sendJson(res,201,{item});
   }
   if(method==='GET'&&url.pathname==='/api/users'){
    const self=sessionUser(req),people=db.prepare(`SELECT * FROM users WHERE visibility='campus' ORDER BY last_seen DESC`).all();return sendJson(res,200,{users:people.filter(user=>user.id!==self?.id).map(user=>publicUser(user,self?.id)),me:self?publicUser(self,self.id):null});
   }
   if(method==='POST'&&url.pathname==='/api/profile'){
    const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');const body=await readBody(req);const allowed=new Set(['name','avatarTone','faculty','year','bio','interests','socialState','visibility']);if(body.name!==undefined)textField(body.name,20,'昵称');if(body.avatarTone!==undefined&&!tones.has(body.avatarTone))return fail(res,400,'奶龙配色无效');const update={name:String(body.name??user.display_name).slice(0,20),tone:tones.has(body.avatarTone)?body.avatarTone:user.avatar_tone,faculty:String(body.faculty??user.faculty).slice(0,60),year:String(body.year??user.year).slice(0,30),bio:String(body.bio??user.bio).slice(0,120),interests:String(body.interests??user.interests).slice(0,80),mood:['active','low'].includes(body.socialState)?body.socialState:user.social_state,visibility:body.visibility==='private'?'private':'campus',id:user.id};for(const key of Object.keys(body))if(!allowed.has(key))delete body[key];db.prepare(`UPDATE users SET display_name=@name,avatar_tone=@tone,faculty=@faculty,year=@year,bio=@bio,interests=@interests,social_state=@mood,visibility=@visibility,last_seen=? WHERE id=?`).run(now(),user.id);const updated=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);publish('profile-updated',{user:publicUser(updated)},updated.visibility==='private'?[user.id]:null);return sendJson(res,200,{user:publicUser(updated,user.id)});
   }
   if(method==='POST'&&url.pathname==='/api/presence'){
    const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');const body=await readBody(req),x=Number(body.x),z=Number(body.z);if(!Number.isFinite(x)||!Number.isFinite(z))return fail(res,400,'位置格式无效');db.prepare('UPDATE users SET x=?,z=?,status=?,area=?,last_seen=? WHERE id=?').run(Math.max(-700,Math.min(700,x)),Math.max(-420,Math.min(430,z)),String(body.status||user.status).slice(0,60),String(body.area||user.area).slice(0,50),now(),user.id);const updated=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);publish('presence',{user:publicUser(updated,user.id)},updated.visibility==='private'?[user.id]:null);return sendJson(res,200,{user:publicUser(updated,user.id)});
   }
   match=url.pathname.match(/^\/api\/messages\/([^/]+)$/);
   if(match){const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');const peerId=decodeURIComponent(match[1]);if(peerId===user.id)return fail(res,400,'不能给自己发送消息');const peer=db.prepare('SELECT id FROM users WHERE id=?').get(peerId);if(!peer)return fail(res,404,'同学不存在');if(method==='GET'){const messages=db.prepare(`SELECT m.*,a.display_name sender_name,b.display_name recipient_name FROM messages m JOIN users a ON a.id=m.sender_id JOIN users b ON b.id=m.recipient_id WHERE (sender_id=? AND recipient_id=?) OR (sender_id=? AND recipient_id=?) ORDER BY created_at`).all(user.id,peerId,peerId,user.id).map(m=>({id:m.id,from:m.sender_id===user.id?'me':'peer',text:m.text,time:new Date(m.created_at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}),createdAt:Date.parse(m.created_at),senderId:m.sender_id,recipientId:m.recipient_id}));return sendJson(res,200,{messages});}if(method==='POST'){const body=await readBody(req),text=textField(body.text,300,'消息'),id=randomUUID(),stamp=now();db.prepare('INSERT INTO messages(id,sender_id,recipient_id,text,created_at) VALUES(?,?,?,?,?)').run(id,user.id,peerId,text,stamp);const message={id,from:'me',text,time:new Date(stamp).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Shanghai'}),createdAt:Date.parse(stamp),senderId:user.id,recipientId:peerId};publish('message-created',{recipientId:peerId,senderId:user.id,message},[user.id,peerId]);return sendJson(res,201,{message});}}
   if(method==='GET'&&url.pathname==='/api/events/stream'){
    const user=sessionUser(req);if(!user)return fail(res,401,'请先登录演示身份');res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`event: connected\ndata: ${JSON.stringify({userId:user.id})}\n\n`);const client={res,userId:user.id};clients.add(client);const heartbeat=setInterval(()=>{try{db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(),user.id);res.write(': heartbeat\n\n')}catch{clearInterval(heartbeat);clients.delete(client)}},20000);req.on('close',()=>{clearInterval(heartbeat);clients.delete(client);if(![...clients].some(other=>other.userId===user.id)){const offlineAt=new Date(Date.now()-60000).toISOString();db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(offlineAt,user.id);const latest=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);publish('presence',{user:publicUser(latest)},latest.visibility==='private'?[user.id]:null)}});return;
   }
   return fail(res,404,'接口不存在');
  }
  if(dev){res.writeHead(404);return res.end('Not found');}
  const dist=path.join(root,'dist');let filePath=path.resolve(dist,decodeURIComponent(url.pathname.slice(1)));if(!filePath.startsWith(dist+path.sep)&&filePath!==dist)filePath=path.join(dist,'index.html');try{if((await stat(filePath)).isDirectory())filePath=path.join(filePath,'index.html');const content=await readFile(filePath);const ext=path.extname(filePath);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(content)}catch{const html=await readFile(path.join(dist,'index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)}
 }catch(error){if(res.headersSent){res.end();return}if(!error.status)console.error('API request failed:',error);fail(res,error.status||500,error.status?error.message:'服务器发生错误');}
});

server.listen(apiPort,host,()=>console.log(`Campus API ready at http://${host}:${apiPort}`));
function shutdown(){for(const client of clients)client.res.end();server.close(()=>{db.close();viteProcess?.kill();process.exit(0)})}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
if(dev){viteProcess=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host',viteHost,'--port','5179'],{cwd:root,stdio:'inherit',windowsHide:true});viteProcess.on('exit',code=>{if(code&&code!==0)console.error(`Vite stopped (${code})`)})}
