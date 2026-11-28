// INV36 probe1: touch overlay inventory (fresh vs suite-context Ashfall),
// fight #24 standalone, fox-vision restore split. Evidence only.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9461);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "inv36-"));
const POLICY = "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
const args = ["--headless=new","--no-sandbox","--disable-dev-shm-usage","--enable-unsafe-swiftshader","--use-angle=swiftshader","--autoplay-policy=no-user-gesture-required"];
if (existsSync(POLICY)) args.push(`--hatch-webgl-allowed-domains-file=${POLICY}`,`--hatch-webgl-allowed-domains-sha256=${createHash("sha256").update(readFileSync(POLICY)).digest("hex")}`);
args.push(`--remote-debugging-port=${PORT}`,`--user-data-dir=${profile}`,"about:blank");
const chrome = spawn(CHROME, args, { stdio: ["ignore","ignore","pipe"] });
chrome.stderr.on("data",()=>{});
async function wsUrl(){for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${PORT}/json/list`);const l=await r.json();const p=l.find(t=>t.type==="page");if(p)return p.webSocketDebuggerUrl;}catch(e){}await sleep(200);}throw new Error("no devtools");}
let msgId=0; const pending=new Map(); let ws;
function send(m,p={}){return new Promise((res,rej)=>{const id=++msgId;const t=setTimeout(()=>{pending.delete(id);rej(new Error("timeout "+m));},30000);pending.set(id,{resolve:v=>{clearTimeout(t);res(v);},reject:e=>{clearTimeout(t);rej(e);}});ws.send(JSON.stringify({id,method:m,params:p}));});}
async function evalJs(e){const r=await send("Runtime.evaluate",{expression:e,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error("page exc: "+(r.exceptionDetails.exception?.description||r.exceptionDetails.text));return r.result.value;}
async function keyDown(k,c){await send("Input.dispatchKeyEvent",{type:"keyDown",key:k,code:c||"",text:k.length===1?k:""});}
async function keyUp(k,c){await send("Input.dispatchKeyEvent",{type:"keyUp",key:k,code:c||""});}
async function key(k,c){await keyDown(k,c);await sleep(90);await keyUp(k,c);await sleep(130);}
async function waitFor(expr,ms,label){const t0=Date.now();while(Date.now()-t0<ms){if(await evalJs(expr))return true;await sleep(250);}console.log("  .. timeout: "+label);return false;}
const INV = `(() => {
  const cv = document.querySelector('#stage canvas');
  const r = cv.getBoundingClientRect();
  const tries = [[0.5,0.3],[0.5,0.2],[0.36,0.3],[0.64,0.3],[0.5,0.42]];
  const pts = tries.map(([fx,fy])=>{ const x=Math.round(r.left+r.width*fx), y=Math.round(r.top+r.height*fy);
    const el=document.elementFromPoint(x,y);
    return {x,y,hit: el?(el.id||el.tagName+'.'+(el.className&&el.className.baseVal!==undefined?'svg':el.className)):null, isCanvas: el===cv}; });
  const vis=[]; document.querySelectorAll('body > div, body > section').forEach(d=>{ const cs=getComputedStyle(d);
    if(cs.display!=='none'&&cs.visibility!=='hidden'&&+cs.opacity>0){ const b=d.getBoundingClientRect();
      if(b.width>200&&b.height>50) vis.push({id:d.id||d.tagName, disp:cs.display, pe:cs.pointerEvents, rect:[Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)], z:cs.zIndex}); }});
  return {canvasRect:[r.left,r.top,r.width,r.height], pts, vis};
})()`;
const WP = `(() => { const cv=document.querySelector('#stage canvas'); const r=cv.getBoundingClientRect();
  const tries=[[0.5,0.3],[0.5,0.3],[0.5,0.2],[0.36,0.3],[0.64,0.3],[0.5,0.42]];
  for(const [tx,ty] of tries){const x=Math.round(r.left+r.width*tx),y=Math.round(r.top+r.height*ty);
    if(document.elementFromPoint(x,y)===cv) return {x,y};} return null; })()`;
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}};
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:URL});
  let booted=false; for(let i=0;i<60&&!booted;i++){await sleep(250); try{booted=await evalJs("!!window.NOVA_FOX3");}catch(e){}}
  console.log("BOOTED", booted, URL);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()"); await sleep(300);
  console.log("STAGE A fresh Nova worldPoint:", JSON.stringify(await evalJs(WP)));
  console.log("STAGE A inventory:", JSON.stringify(await evalJs(INV)));
  // Cross to Ashfall exactly as touch section does
  await key("1","Digit1"); await key("4","Digit4"); await key("9","Digit9");
  await keyDown("w","KeyW");
  const crossed = await waitFor("NOVA_FOX3.state.realm === 'ashfall'",60000,"cross ashfall");
  await keyUp("w","KeyW");
  console.log("CROSSED to ashfall:", crossed, "realm=", await evalJs("NOVA_FOX3.state.realm"));
  await send("Emulation.setTouchEmulationEnabled",{enabled:true,maxTouchPoints:5});
  await evalJs("NOVA_FOX3.teleportTo(120, 120)"); await sleep(400);
  await evalJs("NOVA_FOX3.teleportTo(9, 9)");
  await evalJs("NOVA_FOX3.state.yaw = 0; NOVA_FOX3.state.pitch = 0;");
  await waitFor("NOVA_FOX3.state.onGround",8000,"grounded touch");
  console.log("STAGE B suite-context Ashfall worldPoint:", JSON.stringify(await evalJs(WP)));
  console.log("STAGE B inventory:", JSON.stringify(await evalJs(INV)));
  console.log("STAGE B state:", JSON.stringify(await evalJs("({realm:NOVA_FOX3.state.realm,hp:NOVA_FOX3.state.hp,pos:{x:NOVA_FOX3.state.pos.x,y:NOVA_FOX3.state.pos.y,z:NOVA_FOX3.state.pos.z},splash:NOVA_FOX3.state.splash})")));
  // FIGHT standalone in current realm (ashfall surface monster; suite ran it in nova — mechanism is realm-independent code path)
  const fight = await evalJs(`(() => {
    const a = { x: 8.5, z: 8.5 };
    const realm = NOVA_FOX3.state.realm;
    const m = NOVA_FOX3.sub.monsters.find((m) => m.alive && m.kind === "surface" && m.realmId === realm &&
      Math.hypot(m.gx * 2 + 1 - a.x, m.gy * 2 + 1 - a.z) > 18);
    if (m) NOVA_FOX3.teleportTo(m.gx * 2 + 1, m.gy * 2 + 1);
    return m ? {found:true, realm, gx:m.gx, gy:m.gy} : {found:false, realm,
      kinds: NOVA_FOX3.sub.monsters.filter(x=>x.alive).slice(0,8).map(x=>x.kind+":"+x.realmId)};
  })()`);
  console.log("FIGHT setup:", JSON.stringify(fight));
  console.log("FIGHT audio before:", JSON.stringify(await evalJs("({sfx:NOVA_FOX3.sfxStats(), audio:NOVA_FOX3.audioState(), hp:NOVA_FOX3.state.hp})")));
  const nb = await evalJs("NOVA_FOX3.sfxStats().contactNoises");
  const hb = await evalJs("NOVA_FOX3.state.hp");
  const t0=Date.now(); let dropped=false; const timeline=[];
  while(Date.now()-t0<30000){ const s=await evalJs("({hp:NOVA_FOX3.state.hp,noises:NOVA_FOX3.sfxStats().contactNoises,ctx:NOVA_FOX3.audioState().ctx,muted:NOVA_FOX3.audioState().muted,dead:NOVA_FOX3.state.dead})");
    timeline.push(s); if(s.hp<hb){dropped=true; break;} await sleep(400); }
  await sleep(600);
  const after = await evalJs("({hp:NOVA_FOX3.state.hp,noises:NOVA_FOX3.sfxStats().contactNoises,ctx:NOVA_FOX3.audioState().ctx})");
  console.log("FIGHT result: dropped=",dropped,"noises",nb,"->",after.noises,"hp",hb,"->",after.hp,"ctx=",after.ctx);
  console.log("FIGHT timeline tail:", JSON.stringify(timeline.slice(-4)));
  // VISION: cross home then verbatim sequence with split conjuncts
  await evalJs("NOVA_FOX3.teleportTo(8, 8)"); await sleep(300);
  await key("1","Digit1"); await key("4","Digit4"); await key("9","Digit9");
  await keyDown("w","KeyW");
  const home = await waitFor("NOVA_FOX3.state.realm === 'nova'",60000,"cross home");
  await keyUp("w","KeyW");
  console.log("VISION home:", home, await evalJs("NOVA_FOX3.state.realm"));
  await evalJs("NOVA_FOX3.state.pos.set(52.5, 5.01, 35.5); NOVA_FOX3.state.vel.set(0,0,0);");
  console.log("VISION inHall wait:", await waitFor("NOVA_FOX3.foxVisionState().inHall",5000,"hall entry"), JSON.stringify(await evalJs("NOVA_FOX3.foxVisionState()")));
  const gid = await evalJs(`(() => { let g = NOVA_FOX3.sub.monsters.find((m) => m.alive && m.kind === "guardian");
    if (!g) g = NOVA_FOX3.sub.spawnMonster("nova", 27, 19, "guardian"); return g.id; })()`);
  console.log("VISION guardian id", gid);
  await key("n","KeyN"); await sleep(200);
  console.log("VISION after N on:", JSON.stringify(await evalJs("NOVA_FOX3.foxVisionState()")));
  console.log("VISION lit wait:", await waitFor(`NOVA_FOX3.monsterLit(${gid}) && NOVA_FOX3.monsterOpacity(${gid}) > 0.9`,30000,"keeper lit"));
  await key("n","KeyN");
  const split = await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find((x) => x.id === ${gid}); m.phase = 1;
    return { vision: NOVA_FOX3.foxVisionState(), familiarSeenAtomic: NOVA_FOX3.familiarSeen(${gid}),
      monsterVisible: NOVA_FOX3.sub.monsterVisible(m), litNow: NOVA_FOX3.monsterLit(${gid}) }; })()`);
  console.log("VISION restore split immediately after N-off:", JSON.stringify(split));
  const unlit = await waitFor(`NOVA_FOX3.monsterLit(${gid}) === false`,30000,"keeper unlit");
  console.log("VISION unlit within 30s:", unlit, "lit=", await evalJs(`NOVA_FOX3.monsterLit(${gid})`),
    "seen=", await evalJs(`(() => { const m = NOVA_FOX3.sub.monsters.find((x) => x.id === ${gid}); m.phase = 1; return NOVA_FOX3.familiarSeen(${gid}); })()`),
    "vision=", JSON.stringify(await evalJs("NOVA_FOX3.foxVisionState()")));
} catch(e){ console.log("PROBE ERROR", e.message); }
finally { try{chrome.kill();}catch(e){} process.exit(0); }
