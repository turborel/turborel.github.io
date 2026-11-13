#!/usr/bin/env node
// Draws every favicon from the square sources in scripts/favicon/ into
// src/assets/: favicon.svg (sharp at any size in current browsers), the
// 16 / 32 PNGs, favicon.ico (16, 32, 48) and the home-screen icons.
// Edit the SVGs, then: npm run favicons
//
// Each size is drawn by Chrome straight from the vector at that exact pixel
// size (not shrunk from a big picture), so the spiral stays crisp at 16×16.
// Drives Google Chrome / Chromium over the DevTools protocol (no extra
// packages). Set CHROME=/path/to/chrome if it isn't on the PATH.
import { spawn, execSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = (f) => path.join(root, "scripts/favicon", f);
const out = (f) => path.join(root, "src/assets", f);
const PORT = 9340;

// rounded: browser tabs; square: home screens, which round the corners themselves
const pngs = [
  ["favicon-16x16.png", 16, "favicon.svg"],
  ["favicon-32x32.png", 32, "favicon.svg"],
  ["favicon-48x48.tmp.png", 48, "favicon.svg"],
  ["apple-touch-icon.png", 180, "favicon-square.svg"],
  ["android-chrome-192x192.png", 192, "favicon-square.svg"],
  ["android-chrome-512x512.png", 512, "favicon-square.svg"],
];

const chromePath =
  process.env.CHROME ||
  ["google-chrome", "chromium", "chromium-browser"]
    .map((c) => { try { return execSync(`command -v ${c}`, { encoding: "utf8" }).trim(); } catch { return ""; } })
    .find(Boolean);
if (!chromePath) throw new Error("Chrome or Chromium not found; set CHROME=/path/to/chrome");

const profile = mkdtempSync(path.join(tmpdir(), "favicons-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// An .ico is a small header plus the PNGs themselves (allowed since Vista).
function ico(files) {
  const images = files.map(([size, file]) => ({ size, data: readFileSync(file) }));
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size % 256, e); header.writeUInt8(size % 256, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8); header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((i) => i.data)]);
}

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
  for (const [name, size, svg] of pngs) {
    await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    const html = `<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="data:image/svg+xml;base64,${readFileSync(src(svg)).toString("base64")}">`;
    const loaded = once("Page.loadEventFired");
    await send("Page.navigate", { url: "data:text/html;base64," + Buffer.from(html).toString("base64") });
    await loaded;
    await sleep(100);
    const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    writeFileSync(out(name), Buffer.from(shot.result.data, "base64"));
  }
  ws.close();

  writeFileSync(out("favicon.ico"), ico([[16, out("favicon-16x16.png")], [32, out("favicon-32x32.png")], [48, out("favicon-48x48.tmp.png")]]));
  rmSync(out("favicon-48x48.tmp.png"));
  copyFileSync(src("favicon.svg"), out("favicon.svg"));
  console.log("wrote src/assets/favicon.svg, favicon.ico, " + pngs.filter(([n]) => !n.includes(".tmp")).map(([n]) => n).join(", "));
} finally {
  chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}
