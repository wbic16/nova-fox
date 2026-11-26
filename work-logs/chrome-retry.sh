#!/bin/bash
for i in $(seq 1 12); do
  node -e '
const { spawn } = require("node:child_process");
const c = spawn("/opt/meta-chromium/chrome", ["--headless=new","--disable-gpu","--use-angle=swiftshader","--enable-unsafe-swiftshader","--no-sandbox","--autoplay-policy=no-user-gesture-required","--remote-debugging-port=9335","--remote-debugging-address=127.0.0.1","about:blank"], { stdio: "ignore" });
setTimeout(async () => {
  try { const r = await fetch("http://127.0.0.1:9335/json/list"); console.log("UP"); } catch (e) { console.log("DOWN"); }
  c.kill("SIGKILL"); process.exit(0);
}, 3500);
' > /tmp/chrome-probe.out 2>&1
  if grep -q UP /tmp/chrome-probe.out; then echo "CHROME UP at attempt $i $(date)" > ~/workspace/nova-fox/work-logs/chrome-status.txt; exit 0; fi
  sleep 55
done
echo "CHROME STILL DOWN after 12 attempts $(date)" > ~/workspace/nova-fox/work-logs/chrome-status.txt
