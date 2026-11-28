// Nova Fox demo13 — the Esc menu's e2e legs, standalone.
// The full cdp_test3.mjs suite carries these same legs at its end;
// this file runs just them (boot -> menu) so the menu's behavior is
// browser-verified even when the shared cell is too loaded for the
// full real-time suite. Same harness idioms, same checks.
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const CHROME = "/home/wbic16/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome";
const PORT = 9381;
const URL = "file:///home/wbic16/nf-repo/builds/demo24/index.html";
let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.log(`FAIL  ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), "novafox13-menu-"));
const POLICY = "/home/wbic16/nf-everything/dummy-policy.txt";
const policySha = createHash("sha256").update(readFileSync(POLICY)).digest("hex");
const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
  "--enable-unsafe-swiftshader", "--use-angle=swiftshader",
  "--autoplay-policy=no-user-gesture-required",
  `--hatch-webgl-allowed-domains-file=${POLICY}`,
  `--hatch-webgl-allowed-domains-sha256=${policySha}`,
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: ["ignore", "ignore", "pipe"] });
let ws, seq = 0; const pending = new Map();
const consoleErrors = [];
async function wsUrl() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const j = await r.json();
      const p = j.find((t) => t.type === "page");
      if (p) return p.webSocketDebuggerUrl;
    } catch (e) {}
    await sleep(300);
  }
  throw new Error("no page target");
}
function send(method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((res) => pending.set(id, { resolve: res }));
}
async function evalJs(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true });
  if (r.exceptionDetails) {
    throw new Error("page exception: " +
      (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
  }
  return r.result.value;
}
async function keyDown(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: k, code: code || "", text: k.length === 1 ? k : "" });
}
async function keyUp(k, code) {
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: k, code: code || "" });
}
async function key(k, code) { await keyDown(k, code); await sleep(90); await keyUp(k, code); await sleep(130); }
async function mouse(type, x, y, button, buttons) {
  await send("Input.dispatchMouseEvent", { type, x, y, button: button || "none", buttons: buttons || 0, clickCount: 1 });
}

try {
  ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id).resolve(m.result); pending.delete(m.id); }
    else if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(JSON.stringify(m.params.args));
    } else if (m.method === "Runtime.exceptionThrown") {
      consoleErrors.push("exception: " + (m.params.exceptionDetails.exception?.description || ""));
    }
  };
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: URL });
  let booted = false;
  for (let i = 0; i < 80 && !booted; i++) {
    await sleep(250);
    try { booted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {}
  }
  check("page boots, NOVA_FOX3 handle present", booted);
  await sleep(800);
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);
  // A real canvas click: the gesture that unlocks the audio context.
  await mouse("mousePressed", 400, 300, "left", 1);
  await mouse("mouseReleased", 400, 300, "left", 0);
  await sleep(300);

  await key("Escape", "Escape");
  check("menu: Esc opens the menu",
    await evalJs("NOVA_FOX3.menuState().open") === true &&
    (await evalJs("document.getElementById('menu').style.display")) === "block");
  await key("Escape", "Escape");
  check("menu: Esc closes it again",
    await evalJs("NOVA_FOX3.menuState().open") === false);
  await key("Escape", "Escape");
  await key("ArrowDown", "ArrowDown");
  await key("ArrowDown", "ArrowDown");
  check("menu: the arrow keys move the selection",
    await evalJs("document.querySelectorAll('#menu .menuitem')[2].classList.contains('sel')") === true);
  await key("Enter", "Enter");
  check("menu: Enter works the selected row (the .phext save speaks its count)",
    (await evalJs("document.getElementById('menu-note').textContent")).includes("scrolls"));

  await evalJs("document.getElementById('menu-lan').click()");
  check("menu: Open to LAN never claims a session that does not exist",
    await evalJs("NOVA_FOX3.lanState().open") === false &&
    await evalJs("NOVA_FOX3.lanState().available") === false &&
    (await evalJs("document.getElementById('menu-note').textContent")).includes("no LAN transport"));
  check("menu: the LAN state line says closed",
    (await evalJs("document.getElementById('menu-lan-state').textContent")) === "closed");

  await evalJs("document.getElementById('menu-keys').click()");
  check("menu: the key bindings panel opens",
    await evalJs("NOVA_FOX3.menuState().panel") === "bindings-panel");
  check("menu: the strike binding starts at the default",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyF");
  await evalJs("document.querySelector('button[data-action=\"strike\"]').click()");
  await key("h", "KeyH");
  check("menu: capturing a key remaps the action and persists it",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyH" &&
    await evalJs("JSON.parse(localStorage.getItem('nova-phox-bindings')).strike") === "KeyH");
  await evalJs("document.querySelector('button[data-action=\"chisel\"]').click()");
  await key("h", "KeyH");
  check("menu: taking another action's key swaps the two bindings",
    await evalJs("NOVA_FOX3.bindingFor('chisel')") === "KeyH" &&
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyC");
  await evalJs("document.querySelector('button[data-action=\"strike\"]').click()");
  await key("q", "KeyQ");
  check("menu: a note-row key is refused as a binding, with its reason",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyC" &&
    (await evalJs("document.getElementById('bindings-note').textContent")).includes("already plays a note"));
  await evalJs("document.getElementById('bindings-reset').click()");
  check("menu: reset restores the default bindings",
    await evalJs("NOVA_FOX3.bindingFor('strike')") === "KeyF" &&
    await evalJs("NOVA_FOX3.bindingFor('chisel')") === "KeyC");
  await key("Escape", "Escape");
  check("menu: Esc from a sub-panel returns to the menu",
    await evalJs("NOVA_FOX3.menuState().panel") === "menu");

  await evalJs("document.getElementById('menu-video').click()");
  check("menu: the video panel opens",
    await evalJs("NOVA_FOX3.menuState().panel") === "video-panel");
  const pr0 = await evalJs("NOVA_FOX3.renderScaleNow()");
  await evalJs("document.getElementById('vid-scale').click()");
  check("menu: render scale really reaches the renderer",
    await evalJs("NOVA_FOX3.settings().renderScale") === 0.75 &&
    Math.abs((await evalJs("NOVA_FOX3.renderScaleNow()")) - pr0 * 0.75) < 0.001,
    `pixelRatio ${pr0} -> ${await evalJs("NOVA_FOX3.renderScaleNow()")}`);
  await evalJs("document.getElementById('vid-view').click()");
  check("menu: view distance really moves the chunk radius",
    await evalJs("NOVA_FOX3.renderRadius()") === 4);
  await evalJs("document.getElementById('vid-view').click()");
  await evalJs("document.getElementById('vid-view').click()");
  await evalJs("document.getElementById('vid-scale').click()");
  await evalJs("document.getElementById('vid-scale').click()");
  check("menu: and both cycle home to the shipped settings",
    await evalJs("NOVA_FOX3.renderRadius()") === 3 &&
    await evalJs("NOVA_FOX3.settings().renderScale") === 1);
  await evalJs("document.getElementById('video-back').click()");

  await evalJs("document.getElementById('menu-audio').click()");
  check("menu: the audio panel opens",
    await evalJs("NOVA_FOX3.menuState().panel") === "audio-panel");
  await evalJs("(() => { const r = document.getElementById('aud-master'); r.value = 40; r.dispatchEvent(new Event('input')); })()");
  check("menu: the master volume really reaches the master gain",
    await evalJs("NOVA_FOX3.settings().master") === 0.4 &&
    Math.abs((await evalJs("NOVA_FOX3.masterGain()")) - 0.4) < 0.001,
    `gain ${await evalJs("NOVA_FOX3.masterGain()")}`);
  await evalJs("document.getElementById('aud-mute').click()");
  check("menu: the audio panel's mute is the game's one mute",
    await evalJs("NOVA_FOX3.masterGain()") === 0);
  await evalJs("document.getElementById('aud-mute').click()");
  check("menu: and unmuting restores the set level",
    Math.abs((await evalJs("NOVA_FOX3.masterGain()")) - 0.4) < 0.001);
  await evalJs("document.getElementById('audio-back').click()");

  const urlBefore = await evalJs("location.href");
  await evalJs("document.getElementById('menu-merge').click()");
  await sleep(2000);
  check("menu: merging never navigates away uninvited",
    (await evalJs("location.href")) === urlBefore);
  check("menu: with no sign-in, the merge claims nothing it did not do",
    (await evalJs("NOVA_FOX3.mergeState().hasToken")) === false &&
    !(await evalJs("document.getElementById('menu-note').textContent")).startsWith("merged —"));

  await evalJs("document.getElementById('menu-savephext').click()");
  check("menu: saving the world says what it wrote",
    (await evalJs("document.getElementById('menu-note').textContent")).includes("the world is written out"));
  const wp = await evalJs("(() => { const r = NOVA_FOX3.worldPhext(); return { scrolls: r.scrolls, genesis: r.text.includes('the world is loaded') }; })()");
  check("menu: the export is this session's world, inscription log included",
    wp.scrolls >= 13 && wp.genesis === true, `${wp.scrolls} scrolls`);

  await evalJs("document.getElementById('menu-quit').click()");
  check("menu: quit closes the menu and lands on the title",
    await evalJs("NOVA_FOX3.menuState().open") === false &&
    await evalJs("NOVA_FOX3.state.splash") === true &&
    (await evalJs("document.getElementById('splash').style.display")) === "flex");
  await evalJs("document.getElementById('splash-btn').click()");
  await sleep(200);

  await evalJs("localStorage.setItem('nova-phox-standings', JSON.stringify({ best: 4242, score: 4242 }))");
  await evalJs("localStorage.setItem('nova-phox-name', JSON.stringify('e2e-old-name'))");
  await key("Escape", "Escape");
  await evalJs("document.getElementById('menu-newgame').click()");
  check("menu: a new game asks first — nothing is wiped yet",
    await evalJs("NOVA_FOX3.menuState().newGameArmed") === true &&
    (await evalJs("JSON.parse(localStorage.getItem('nova-phox-standings')).best")) === 4242);
  await evalJs("document.getElementById('menu-confirm-no').click()");
  check("menu: keeping playing disarms the gate, record intact",
    await evalJs("NOVA_FOX3.menuState().newGameArmed") === false &&
    (await evalJs("JSON.parse(localStorage.getItem('nova-phox-standings')).best")) === 4242);
  await evalJs("document.getElementById('menu-newgame').click()");
  await evalJs("document.getElementById('menu-confirm-yes').click()");
  let rebooted = false;
  for (let i = 0; i < 60 && !rebooted; i++) {
    await sleep(250);
    try { rebooted = await evalJs("!!window.NOVA_FOX3"); } catch (e) {}
  }
  await sleep(800);
  check("menu: confirming starts over — the old record and name are gone",
    rebooted === true &&
    (await evalJs("JSON.parse(localStorage.getItem('nova-phox-standings') || '{}').best || 0")) !== 4242 &&
    (await evalJs("NOVA_FOX3.saveJson().name")) !== "e2e-old-name");
  check("menu: a new game keeps the machine's keepings (bindings, settings, controls)",
    await evalJs("localStorage.getItem('nova-phox-bindings')") !== null &&
    await evalJs("localStorage.getItem('nova-phox-settings')") !== null &&
    await evalJs("localStorage.getItem('nova-phox-controls')") !== null);
  check("menu: the fresh game wakes at the first guide beat",
    await evalJs("NOVA_FOX3.guideCurrent().id") === "wake");

  check("no page console errors", consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(" | "));
} catch (e) {
  fail++;
  console.log("FAIL  harness error:", e.message);
} finally {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill("SIGKILL");
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
