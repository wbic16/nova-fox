// INV36 probe2: board-blocks-worldPoint test; Nova fight #24 sampling;
// veer->straight suite-context chain (Cluster D) + veer geometry.
// STAGE env: board|fight|veer|all (default all). NF_URL selects tree.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
const CHROME = process.env.NF_CHROME || "/opt/meta-chromium/chrome";
const PORT = Number(process.env.NF_PORT || 9467);
const URL = process.env.NF_URL || pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), "index.html")).href;
const STAGE = process.env.STAGE || "all";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "inv36b-"));
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
    const stack=document.elementsFromPoint(x,y).slice(0,4).map(e=>e.id||e.tagName);
    return {x,y,stack};}); })()`;
try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
  ws.onmessage=(ev)=>{const m=JSON.parse(ev.data); if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}};
  await send("Runtime.enable"); await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride",{width:1280,height:800,deviceScaleFactor:1,mobile:false});
  await send("Page.navigate",{url:URL});
  let booted=false; for(let i=0;i<60&&!booted;i++){await sleep(250); try{booted=await evalJs("!!window.NOVA_FOX3");}catch(e){}}
  console.log("BOOTED", booted, URL, "STAGE", STAGE);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()"); await sleep(300);

  if (STAGE==="board"||STAGE==="all") {
    console.log("BOARD worldPoint before open:", JSON.stringify(await evalJs(WP)));
    await evalJs("document.getElementById('btn-board').click()"); await sleep(500);
    console.log("BOARD display:", await evalJs("document.getElementById('board').style.display"),
      "rect:", JSON.stringify(await evalJs("(() => { const b=document.getElementById('board').getBoundingClientRect(); return [Math.round(b.left),Math.round(b.top),Math.round(b.width),Math.round(b.height)]; })()")));
    console.log("BOARD worldPoint with board open:", JSON.stringify(await evalJs(WP)));
    console.log("BOARD hits:", JSON.stringify(await evalJs(HITS)));
    await evalJs("document.getElementById('btn-board').click()"); await sleep(300);
    console.log("BOARD worldPoint after close click:", JSON.stringify(await evalJs(WP)),
      "display:", await evalJs("document.getElementById('board').style.display"));
  }

  if (STAGE==="fight"||STAGE==="all") {
    const setup = await evalJs(`(() => {
      const a = { x: 8.5, z: 8.5 };
      const m = NOVA_FOX3.sub.monsters.find((m) => m.alive && m.kind === "surface" && m.realmId === "nova" &&
        Math.hypot(m.gx * 2 + 1 - a.x, m.gy * 2 + 1 - a.z) > 18);
      if (m) NOVA_FOX3.teleportTo(m.gx * 2 + 1, m.gy * 2 + 1);
      return m ? {id:m.id, gx:m.gx, gy:m.gy} : null; })()`);
    console.log("FIGHT setup monster:", JSON.stringify(setup));
    const nb = await evalJs("NOVA_FOX3.sfxStats().contactNoises");
    const hb = await evalJs("NOVA_FOX3.state.hp");
    console.log("FIGHT before: hp", hb, "noises", nb, "audio", JSON.stringify(await evalJs("NOVA_FOX3.audioState()")),
      "warded-check pos", JSON.stringify(await evalJs("({x:NOVA_FOX3.state.pos.x,y:NOVA_FOX3.state.pos.y,z:NOVA_FOX3.state.pos.z,firstJump:NOVA_FOX3.state.firstJumpDone})")));
    const t0=Date.now(); let last="";
    while(Date.now()-t0<35000){
      const s = await evalJs(`(() => { const st=NOVA_FOX3.state; const m=NOVA_FOX3.sub.monsters.find(x=>x.id===${setup?setup.id:-1});
        return {hp:st.hp, noises:NOVA_FOX3.sfxStats().contactNoises, ctx:NOVA_FOX3.audioState().ctx,
          pos:[+st.pos.x.toFixed(1),+st.pos.y.toFixed(1),+st.pos.z.toFixed(1)],
          mon: m?{phase:m.phase, eng:!!m.engaged, seen:NOVA_FOX3.familiarSeen(m.id), gx:m.gx, gy:m.gy}:null}; })()`);
      const line = JSON.stringify(s);
      if (line!==last){ console.log("FIGHT t+"+((Date.now()-t0)/1000).toFixed(1)+"s", line); last=line; }
      if (s.hp<hb){ console.log("FIGHT DROP observed; +800ms later noises=", await (async()=>{await sleep(800); return evalJs("NOVA_FOX3.sfxStats().contactNoises");})()); break; }
      await sleep(150);
    }
    console.log("FIGHT final hp", await evalJs("NOVA_FOX3.state.hp"), "noises", await evalJs("NOVA_FOX3.sfxStats().contactNoises"));
  }

  if (STAGE==="veer"||STAGE==="all") {
    await evalJs("NOVA_FOX3.teleportTo(8, 8)"); await sleep(400);
    const terrain = await evalJs(`(() => {
      const S = NOVA_FOX3, st = S.state;
      const g = (x, z) => S.surfaceY(x, z) - 1;
      const cx = Math.floor(st.pos.x), cz = Math.floor(st.pos.z);
      let flat = null, steep = null;
      for (let x = cx - 48; x <= cx + 48 && !(flat && steep); x++) {
        for (let z = cz - 48; z <= cz + 48 && !(flat && steep); z++) {
          const g0 = g(x, z); let maxRise = -Infinity;
          for (let i = 0; i < 36; i++) {
            const yaw = i / 36 * Math.PI * 2;
            const gr = g(Math.floor(x + 0.5 - Math.sin(yaw) * 3.4), Math.floor(z + 0.5 - Math.cos(yaw) * 3.4));
            if (gr - g0 > maxRise) maxRise = gr - g0;
            if (!flat && maxRise <= 1) { let level = true;
              for (const s of [0.85, 1.7, 2.55, 3.4]) { const gs = g(Math.floor(x + 0.5 - Math.sin(yaw) * s), Math.floor(z + 0.5 - Math.cos(yaw) * s));
                if (Math.abs(gs - g0) > 0.5) { level = false; break; } }
              if (level) flat = { x, z, yaw }; }
          }
          if (!steep && maxRise >= 2.6) steep = { x, z, rise: maxRise };
        } }
      return { flat, steep, realm: st.realm, hp: st.hp }; })()`);
    console.log("VEER terrain:", JSON.stringify(terrain));
    if (terrain && terrain.flat) {
      const conRun = async (line) => { const before=(await evalJs("NOVA_FOX3.nfConsole.text()")).length;
        await evalJs(`NOVA_FOX3.nfConsole.run(${JSON.stringify(line)})`);
        return (await evalJs("NOVA_FOX3.nfConsole.text()")).slice(before); };
      await evalJs(`NOVA_FOX3.teleportTo(${terrain.flat.x}, ${terrain.flat.z})`);
      await evalJs(`NOVA_FOX3.state.yaw = ${terrain.flat.yaw}`);
      await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
      const veerOut = await conRun("rift-veer");
      await evalJs("localStorage.removeItem('nova-phox-token')");
      console.log("VEER out:", veerOut.trim().split("\n").slice(-3).join(" | "));
      console.log("VEER post state:", JSON.stringify(await evalJs("({realm:NOVA_FOX3.state.realm,hp:NOVA_FOX3.state.hp,dead:NOVA_FOX3.state.dead,pos:[NOVA_FOX3.state.pos.x,NOVA_FOX3.state.pos.y,NOVA_FOX3.state.pos.z]})")));
      // STRAIGHT in suite context: harness teleports to the SAME (Nova) flat coords without crossing home
      await evalJs(`NOVA_FOX3.teleportTo(${terrain.flat.x}, ${terrain.flat.z})`);
      await evalJs(`NOVA_FOX3.state.yaw = ${terrain.flat.yaw}`);
      console.log("STRAIGHT pre (after teleportTo flat in current realm):", JSON.stringify(await evalJs(`(() => { const st=NOVA_FOX3.state;
        return {realm:st.realm, hp:st.hp, dead:st.dead, pos:[+st.pos.x.toFixed(1),+st.pos.y.toFixed(1),+st.pos.z.toFixed(1)],
          surfY:NOVA_FOX3.surfaceY(st.pos.x, st.pos.z)}; })()`)));
      await sleep(1200);
      console.log("STRAIGHT pre+1.2s:", JSON.stringify(await evalJs("({hp:NOVA_FOX3.state.hp,dead:NOVA_FOX3.state.dead,y:+NOVA_FOX3.state.pos.y.toFixed(1),onGround:NOVA_FOX3.state.onGround})")));
      await evalJs("localStorage.setItem('nova-phox-token', JSON.stringify('e2e-console-token'))");
      const straightP = conRun("rift-straight");
      const t0=Date.now(); let last="";
      while(Date.now()-t0<16000){ const s=await evalJs("({hp:NOVA_FOX3.state.hp,dead:NOVA_FOX3.state.dead,realm:NOVA_FOX3.state.realm,pos:[+NOVA_FOX3.state.pos.x.toFixed(1),+NOVA_FOX3.state.pos.y.toFixed(1),+NOVA_FOX3.state.pos.z.toFixed(1)]})");
        const l=JSON.stringify(s); if(l!==last){console.log("STRAIGHT sample", l); last=l;} await sleep(250); }
      const straightOut = await straightP;
      await evalJs("localStorage.removeItem('nova-phox-token')");
      console.log("STRAIGHT out:", straightOut.trim().split("\n").slice(-3).join(" | "));
    }
  }
} catch(e){ console.log("PROBE ERROR", e.message); }
finally { try{chrome.kill();}catch(e){} process.exit(0); }
