// Geometry for the home page's patch bay: Rust and each official driver get
// a socket and a cable to a dotted ring of database nodes; the CLI and Studio
// hang off it too. Two layouts, both plain SVG in the page (JavaScript only
// animates the nodes):
//   wide  sockets either side of the ring (wide screens)
//   tall  the ring on top, sockets in two columns under it, each cable
//         running up its own lane at the edge (phones and tablets), drawn
//         larger so its text stays readable when scaled down
import fs from "node:fs";
import ecosystem from "./ecosystem.js";

// A driver's or Studio's docs page when the latest docs have it
// (scripts/fetch-docs.js found its doc/ folder), else its repository.
let published = new Set();
try {
  const { versions } = JSON.parse(fs.readFileSync(".cache/docs/versions.json", "utf8"));
  const latest = versions.find((v) => v.latest) || versions[0];
  published = new Set((latest.sets || []).map((x) => x.path));
} catch {}
const docsUrl = (e) => (e.docs && published.has(e.docs) ? `/docs/${e.docs}/` : e.url);

const COLORS = ["#F4B08A", "#E58A5C", "#F1DDD2", "#FFFFFF"];
const f = (n) => +n.toFixed(1);
const rad = (d) => (d * Math.PI) / 180;

// One small database cylinder centred on (x, y), dotted with pattern #pid.
function cylinder(x, y, top, pid) {
  const s = 0.62, rx = f(42 * s), ry = f(13 * s), hh = f(68 * s), t = f(y - hh / 2);
  const body = `M${f(x - rx)},${t} v${hh} a${rx},${ry} 0 0 0 ${f(2 * rx)},0 v-${hh}`;
  const band = (dy) => `M${f(x - rx)},${f(t + dy)} a${rx},${ry} 0 0 0 ${f(2 * rx)},0`;
  return `<path d="${body}" fill="#F1DDD2"/><path d="${body}" fill="url(#${pid})"/>` +
    `<path d="${band(hh / 3)} ${band((2 * hh) / 3)}" fill="none" stroke="#5C282B" stroke-width="2"/>` +
    `<ellipse cx="${f(x)}" cy="${t}" rx="${rx}" ry="${ry}" fill="${top}"/>`;
}

function entries() {
  return [
    { label: ecosystem.builtin.language, sub: "built in", url: ecosystem.builtin.url, native: true },
    ...ecosystem.official.map((d) => ({ label: d.language, url: docsUrl(d) })),
  ].map((d, i) => ({ ...d, color: d.native ? "#FFFFFF" : COLORS[(i - 1) % COLORS.length] }));
}

// node positions: the middle and six around it, scaled to the ring
const slots = (cx, cy, k) => [[0, 0], [0, -92], [80, -46], [80, 46], [0, 92], [-80, 46], [-80, -46]].map(([dx, dy]) => [f(cx + dx * k), f(cy + dy * k)]);

function wide(list) {
  const cx = 500, cy = 330, r = 165;
  const pt = (deg) => [f(cx + r * Math.cos(rad(deg))), f(cy + r * Math.sin(rad(deg)))];
  const leftN = Math.ceil(list.length / 2);
  const jacks = list.map((d, i) => {
    const left = i < leftN, k = left ? i : i - leftN, n = left ? leftN : list.length - leftN;
    const gap = n > 1 ? Math.min(55, 220 / (n - 1)) : 0;
    const y = f(380 - ((n - 1) * gap) / 2 + k * gap), x = left ? 172 : 828;
    const step = n > 1 ? Math.min(11, 44 / (n - 1)) : 0;
    const [ex, ey] = pt(left ? 180 + ((n - 1) / 2 - k) * step : (k - (n - 1) / 2) * step);
    const c1 = left ? x + 120 : x - 120, c2 = left ? ex - 90 : ex + 90;
    return {
      ...d, x, y, end: [ex, ey], tx: left ? x - 22 : x + 22, ty: d.sub ? y + 2 : y + 7, sy: y + 18, anchor: left ? "end" : "start",
      cable: `M${x},${y} C${c1},${y} ${c2},${ey} ${ex},${ey}`,
    };
  });
  const [s1x, s1y] = pt(70), [s2x, s2y] = pt(110);
  return {
    viewBox: "0 150 1000 455", cx, cy, r, sock: 9, jacks, slots: slots(cx, cy, 1),
    cli: { x: 320, y: 512, lx: 306, ly: 546, anchor: "end", cable: `M${s2x},${s2y} C${s2x},${f(s2y + 20)} 380,495 380,512` },
    studio: { x: 560, y: 512, lx: 694, ly: 546, anchor: "start", cable: `M${s1x},${s1y} C${s1x},${f(s1y + 20)} 620,495 620,512` },
  };
}

function tall(list) {
  const cx = 300, cy = 190, r = 150, sock = 12, top = 450, gap = 76;
  const leftN = Math.ceil(list.length / 2);
  const rows = Math.max(leftN, list.length - leftN);
  const jacks = list.map((d, i) => {
    const left = i < leftN, k = left ? i : i - leftN;
    const x = left ? 70 : 530, y = top + k * gap;
    const lane = left ? 52 - k * 8 : 548 + k * 8;
    const deg = left ? 128 + k * (44 / Math.max(1, rows - 1)) : 52 - k * (44 / Math.max(1, rows - 1));
    const ex = f(cx + r * Math.cos(rad(deg))), ey = f(cy + r * Math.sin(rad(deg)));
    return {
      ...d, x, y, end: [ex, ey], tx: left ? x + 24 : x - 24, ty: d.sub ? y + 2 : y + 9, sy: y + 26, anchor: left ? "start" : "end",
      cable: `M${left ? x - sock : x + sock},${y} H${lane} V${f(ey + 40)} Q${lane},${ey} ${ex},${ey}`,
    };
  });
  const bottom = top + (rows - 1) * gap + 70;
  const down = (x) => f(cy + Math.sqrt(r * r - (x - cx) ** 2));
  return {
    viewBox: `0 30 600 ${bottom + 176 - 30}`, cx, cy, r, sock, jacks, slots: slots(cx, cy, 0.9), tall: true,
    cli: { x: 90, y: bottom, lx: 150, ly: bottom + 112, anchor: "middle", cable: `M270,${down(270)} V${bottom - 24} H150 V${bottom}` },
    studio: { x: 390, y: bottom, lx: 450, ly: bottom + 112, anchor: "middle", cable: `M330,${down(330)} V${bottom - 24} H450 V${bottom}` },
  };
}

export default function () {
  const list = entries();
  const tool = (name) => ecosystem.tools.find((t) => t.name === name);
  return {
    layouts: [wide(list), tall(list)],
    cliUrl: tool("CLI").url,
    studioUrl: docsUrl(tool("Studio")),
    live: [0, 2, 5], // the nodes shown at first, and without JavaScript
    cylinder,
    docsUrl,
  };
}
