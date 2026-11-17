#!/usr/bin/env node
// Draws the home page's terminal picture, src/assets/cli.png, from
// src/assets/cli-shot.html at twice its size, on a transparent background
// (the window's shadow included). Edit the HTML, then: npm run cli-shot
//
// The HTML holds a real session of the turborel client, pasted in as it
// printed. Drives Google Chrome / Chromium over the DevTools protocol (no
// extra packages). Set CHROME=/path/to/chrome if it isn't on the PATH.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const page = path.join(root, "src/assets/cli-shot.html");
const out = path.join(root, "src/assets/cli.png");
const PORT = 9341;
const SCALE = 2;

const chromePath =
  process.env.CHROME ||
  ["google-chrome", "chromium", "chromium-browser"]
    .map((c) => { try { return execSync(`command -v ${c}`, { encoding: "utf8" }).trim(); } catch { return ""; } })
    .find(Boolean);
if (!chromePath) throw new Error("Chrome or Chromium not found; set CHROME=/path/to/chrome");

const profile = mkdtempSync(path.join(tmpdir(), "cli-shot-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === "page"); } catch {}
    if (!target) await sleep(200);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r));
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method) events.forEach((f) => f(m));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const once = (method) => new Promise((r) => { const f = (m) => { if (m.method === method) { events.splice(events.indexOf(f), 1); r(); } }; events.push(f); });

  await send("Page.enable");
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send("Emulation.setDeviceMetricsOverride", { width: 780, height: 600, deviceScaleFactor: SCALE, mobile: false });
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: "file://" + page });
  await loaded;
  await send("Runtime.evaluate", { expression: "document.fonts.ready.then(() => true)", awaitPromise: true });
  await sleep(150);
  const size = await send("Runtime.evaluate", {
    expression: "JSON.stringify([document.body.scrollWidth, document.body.scrollHeight])",
    returnByValue: true,
  });
  const [width, height] = JSON.parse(size.result.result.value);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  ws.close();
  console.log(`wrote src/assets/cli.png (${width * SCALE}×${height * SCALE})`);
} finally {
  chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}
