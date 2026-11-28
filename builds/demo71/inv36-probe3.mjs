// INV36 probe3: board-only worldPoint; Ashfall-at-Nova-flat death watch (Cluster D chain);
// fight-pinned contact (pin fox onto monster, unlocked audio).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9469);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;
const STAGE = process.env.STAGE || "all";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "inv36c-"));
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
const WP = `(() => { const cv=document.querySelector('#stage canvas'); const r=cv.getBoundingClientRect();
  const tries=[[0.5,0.3],[0.5,0.3],[0.5,0.2],[0.36,0.3],[0.64,0.3],[0.5,0.42]];
  for(const [tx,ty] of tries){const x=Math.round(r.left+r.width*tx),y=Math.round(r.top+r.height*ty);
    if(document.elementFromPoint(x,y)===cv) return {x,y};} return null; })()`;
const HITS = `(() => { const cv=document.querySelector('#stage canvas'); const r=cv.getBoundingClientRect();
  const tries=[[0.5,0.3],[0.5,0.2],[0.36,0.3],[0.64,0.3],[0.5,0.42]];
  return tries.map(([fx,fy])=>{const x=Math.round(r.left+r.width*fx),y=Math.round(r.top+r.height*fy);
    return {x,y,stack:document.elementsFromPoint(x,y).slice(0,4).map(e=>e.id||e.tagName)};}); })()`;
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}};
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:URL});
  let booted=false; for(let i=0;i<60&&!booted;i++){await sleep(250); try{booted=await evalJs("!!window.NOVA_FOX3");}catch(e){}}
  console.log("BOOTED", booted, "STAGE", STAGE);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()"); await sleep(300);

  if (STAGE==="board"||STAGE==="all") {
    console.log("BOARD wp before:", JSON.stringify(await evalJs(WP)));
    await evalJs("document.getElementById('btn-board').click()"); await sleep(600);
    console.log("BOARD rect:", JSON.stringify(await evalJs("(() => { const b=document.getElementById('board').getBoundingClientRect(); return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height), document.getElementById('board').style.display]; })()")));
    console.log("BOARD wp open:", JSON.stringify(await evalJs(WP)));
    console.log("BOARD hits:", JSON.stringify(await evalJs(HITS)));
  }

  if (STAGE==="ashfall"||STAGE==="all") {
    await key("1","Digit1"); await key("4","Digit4"); await key("9","Digit9");
    await keyDown("w","KeyW");
    const crossed = await waitFor("NOVA_FOX3.state.realm === 'ashfall'",60000,"cross ashfall");
    await keyUp("w","KeyW");
    console.log("ASH crossed:", crossed);
    // Nova flat stance found by probe2 search from (8,8): (-40,-40) yaw 0.5236
    await evalJs("NOVA_FOX3.teleportTo(-40, -40)");
    await evalJs("NOVA_FOX3.state.yaw = 0.5235987755982988");
    console.log("ASH at Nova-flat coords:", JSON.stringify(await evalJs("(() => { const st=NOVA_FOX3.state; return {realm:st.realm,hp:st.hp,dead:st.dead,pos:[+st.pos.x.toFixed(1),+st.pos.y.toFixed(1),+st.pos.z.toFixed(1)],surfY:NOVA_FOX3.surfaceY(st.pos.x,st.pos.z),onGround:st.onGround}; })()")));
    const t0=Date.now(); let last="";
    while(Date.now()-t0<10000){ const s=await evalJs("({hp:NOVA_FOX3.state.hp,dead:NOVA_FOX3.state.dead,y:+NOVA_FOX3.state.pos.y.toFixed(1),onGround:NOVA_FOX3.state.onGround})");
      const l=JSON.stringify(s); if(l!==last){console.log("ASH watch", l); last=l;} await sleep(300); }
    const conRun = async (line) => { const before=(await evalJs("NOVA_FOX3.nfConsole.text()")).length;
      await evalJs(`NOVA_FOX3.nfConsole.run(${JSON.stringify(line)})`);
      return (await evalJs("NOVA_FOX3.nfConsole.text()")).slice(before); };
    await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
    const sp = conRun("rift-straight");
    const t1=Date.now(); last="";
    while(Date.now()-t1<16000){ const s=await evalJs("({hp:NOVA_FOX3.state.hp,dead:NOVA_FOX3.state.dead,realm:NOVA_FOX3.state.realm,pos:[+NOVA_FOX3.state.pos.x.toFixed(1),+NOVA_FOX3.state.pos.y.toFixed(1),+NOVA_FOX3.state.pos.z.toFixed(1)]})");
      const l=JSON.stringify(s); if(l!==last){console.log("ASH straight sample", l); last=l;} await sleep(250); }
    console.log("ASH straight out:", (await sp).trim().split("\n").slice(-3).join(" | "));
    await evalJs("localStorage.removeItem('nova-phox-token')");
  }

  if (STAGE==="fightpin"||STAGE==="all") {
    // back home if needed
    if ((await evalJs("NOVA_FOX3.state.realm"))!=="nova") {
      await evalJs("NOVA_FOX3.teleportTo(8, 8)"); await sleep(300);
      await key("1","Digit1"); await key("4","Digit4"); await key("9","Digit9");
      await keyDown("w","KeyW"); await waitFor("NOVA_FOX3.state.realm === 'nova'",60000,"home"); await keyUp("w","KeyW");
    }
    await key("w","KeyW"); // a real gesture: sfx.unlock path via keydown handlers
    console.log("FIGHTPIN audio after gesture:", JSON.stringify(await evalJs("NOVA_FOX3.audioState()")));
    const mid = await evalJs(`(() => { const a={x:8.5,z:8.5};
      const m=NOVA_FOX3.sub.monsters.find(m=>m.alive&&m.kind==="surface"&&m.realmId==="nova"&&Math.hypot(m.gx*2+1-a.x,m.gy*2+1-a.z)>18);
      return m?m.id:null; })()`);
    console.log("FIGHTPIN monster id", mid);
    const nb = await evalJs("NOVA_FOX3.sfxStats().contactNoises");
    const hb = await evalJs("NOVA_FOX3.state.hp");
    const t0=Date.now(); let dropped=false;
    while(Date.now()-t0<30000){
      await evalJs(`(() => { const m=NOVA_FOX3.sub.monsters.find(x=>x.id===${mid}); if(m) NOVA_FOX3.teleportTo(m.gx*2+1, m.gy*2+1); return !!m; })()`);
      await sleep(500);
      const s = await evalJs("({hp:NOVA_FOX3.state.hp,noises:NOVA_FOX3.sfxStats().contactNoises,ctx:NOVA_FOX3.audioState().ctx})");
      if (s.hp<hb){ dropped=true; console.log("FIGHTPIN drop at", ((Date.now()-t0)/1000).toFixed(1)+"s", JSON.stringify(s), "noisesBefore", nb); break; }
    }
    console.log("FIGHTPIN dropped:", dropped, "final", JSON.stringify(await evalJs("({hp:NOVA_FOX3.state.hp,noises:NOVA_FOX3.sfxStats().contactNoises,ctx:NOVA_FOX3.audioState().ctx})")), "nb", nb, "hb", hb);
  }
} catch(e){ console.log("PROBE ERROR", e.message); }
finally { try{chrome.kill();}catch(e){} process.exit(0); }
