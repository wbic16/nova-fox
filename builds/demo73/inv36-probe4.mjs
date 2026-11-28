// INV36 probe4: fight with ward lifted (real jump first), then pin contact; sample everything.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9473);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "inv36d-"));
const POLICY = process.env.NF_POLICY || "/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt";
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
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}};
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:URL});
  let booted=false; for(let i=0;i<60&&!booted;i++){await sleep(250); try{booted=await evalJs("!!window.NOVA_FOX3");}catch(e){}}
  console.log("BOOTED", booted);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()"); await sleep(300);
  // Lift the ward the player's way: walk a little and jump (firstJumpDone).
  await keyDown("w","KeyW"); await sleep(1200); await keyUp("w","KeyW");
  await key(" ","Space");
  await waitFor("NOVA_FOX3.state.onGround",8000,"land");
  await sleep(600);
  console.log("WARD state:", JSON.stringify(await evalJs("({firstJump:NOVA_FOX3.state.firstJumpDone,jumped:NOVA_FOX3.state.jumped,ctx:NOVA_FOX3.audioState().ctx})")));
  const setup = await evalJs(`(() => { const a={x:8.5,z:8.5};
    const m=NOVA_FOX3.sub.monsters.find(m=>m.alive&&m.kind==="surface"&&m.realmId==="nova"&&Math.hypot(m.gx*2+1-a.x,m.gy*2+1-a.z)>18);
    if(m) NOVA_FOX3.teleportTo(m.gx*2+1, m.gy*2+1);
    return m?{id:m.id,gx:m.gx,gy:m.gy}:null; })()`);
  console.log("FIGHT setup:", JSON.stringify(setup));
  const nb = await evalJs("NOVA_FOX3.sfxStats().contactNoises");
  const hb = await evalJs("NOVA_FOX3.state.hp");
  const t0=Date.now(); let last="";
  while(Date.now()-t0<35000){
    const s = await evalJs(`(() => { const st=NOVA_FOX3.state; const m=NOVA_FOX3.sub.monsters.find(x=>x.id===${setup?setup.id:-1});
      return {hp:st.hp, noises:NOVA_FOX3.sfxStats().contactNoises, ctx:NOVA_FOX3.audioState().ctx,
        pos:[+st.pos.x.toFixed(1),+st.pos.y.toFixed(1),+st.pos.z.toFixed(1)], dead:st.dead,
        mon:m?{phase:m.phase,eng:!!m.engaged,seen:NOVA_FOX3.familiarSeen(m.id),gx:m.gx,gy:m.gy}:null}; })()`);
    const l=JSON.stringify(s); if(l!==last){console.log("F t+"+((Date.now()-t0)/1000).toFixed(1), l); last=l;}
    if (s.hp<hb){ console.log("DROP: noises", nb, "->", s.noises, "ctx", s.ctx); break; }
    await sleep(200);
  }
  console.log("FIGHT end:", JSON.stringify(await evalJs("({hp:NOVA_FOX3.state.hp,noises:NOVA_FOX3.sfxStats().contactNoises,ctx:NOVA_FOX3.audioState().ctx})")), "nb", nb, "hb", hb);
} catch(e){ console.log("PROBE ERROR", e.message); }
finally { try{chrome.kill();}catch(e){} process.exit(0); }
