#!/usr/bin/env node
// Renders scripts/og/og-image.html to src/assets/og-image.png at exactly
// 1200×630: the share picture (og:image) for the home page and for pages
// without a cover of their own. Edit the HTML, then: npm run og-image
//
// Drives Google Chrome / Chromium over the DevTools protocol (no extra
// packages). Set CHROME=/path/to/chrome if it isn't on the PATH.
import { spawn, execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const page = `file://${root}/scripts/og/og-image.html`;
const out = path.join(root, "src/assets/og-image.png");
const W = 1200, H = 630, PORT = 9339;

const chromePath =
  process.env.CHROME ||
  ["google-chrome", "chromium", "chromium-browser"]
    .map((c) => { try { return execSync(`command -v ${c}`, { encoding: "utf8" }).trim(); } catch { return ""; } })
    .find(Boolean);
if (!chromePath) throw new Error("Chrome or Chromium not found; set CHROME=/path/to/chrome");

const profile = mkdtempSync(path.join(tmpdir(), "og-image-"));
const chrome = spawn(chromePath, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
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
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  const loaded = once("Page.loadEventFired");
  await send("Page.navigate", { url: page });
  await loaded;
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
  // The name must be in the site's own font, never a fallback.
  const font = await send("Runtime.evaluate", {
    expression: `document.fonts.check('700 104px "EB Garamond"') && [...document.fonts].some((f) => f.family.replace(/"/g, "") === "EB Garamond" && f.status === "loaded")`,
    returnByValue: true,
  });
  if (!font.result.result.value) throw new Error("EB Garamond didn't load (offline?); not writing the image");
  await sleep(300);
  const shot = await send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
  writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log(`wrote ${path.relative(root, out)} (${W}×${H})`);
  ws.close();
} finally {
  chrome.kill();
  await sleep(200);
  rmSync(profile, { recursive: true, force: true });
}
