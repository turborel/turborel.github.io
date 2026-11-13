// Turns .cache/docs (written by scripts/fetch-docs.js) into one page
// object per document per version, for src/docs/page.njk to paginate.
//
// URLs:
//   /docs/<page>/            the latest version (the latest release, or alpha
//                            while there is none); the canonical, indexed copy
//   /docs/<version>/<page>/  every version, the latest included: the
//                            permanent link to that version's page, e.g.
//                            /docs/alpha/..., /docs/0.1/... (copies of the
//                            latest point search engines at /docs/<page>/)
//   /docs/dev/<page>/        main, once releases exist (noindex); the old
//                            /docs/alpha/<page>/ links then redirect here
// Codenames are shown in titles and breadcrumbs, never in URLs.
//
// Numbers in file names are dropped from URLs, so reordering chapters
// doesn't break links: user/02-getting-started.md -> user/getting-started/.

import fs from "node:fs";
import path from "node:path";
import { createMarkdown } from "../../lib/markdown.js";

const ROOT = path.resolve(".cache/docs");
const DIR_ORDER = ["", "user", "sql", "sql/statements", "operator", "client", "appendix"];
const STRICT = process.env.DOCS_STRICT_LINKS === "1";

const md = createMarkdown();

function walk(dir, base = "") {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else if (e.name.endsWith(".md")) out.push(rel);
  }
  return out;
}

function pagePathOf(rel) {
  const dir = path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel);
  const base = path.posix.basename(rel, ".md");
  if (base.toLowerCase() === "readme") return dir;
  let slug = base.replace(/^\d+[-_]/, "");
  if (dir === "appendix") slug = slug.replace(/^[a-z]-/, "");
  return dir ? `${dir}/${slug}` : slug;
}

function orderKey(rel) {
  const dir = path.posix.dirname(rel) === "." ? "" : path.posix.dirname(rel);
  const base = path.posix.basename(rel, ".md");
  let d = DIR_ORDER.indexOf(dir);
  if (d < 0) d = DIR_ORDER.length;
  const readme = base.toLowerCase() === "readme" ? 0 : 1;
  return [d, dir, readme, base];
}

function cmp(a, b) {
  const x = orderKey(a), y = orderKey(b);
  for (let i = 0; i < x.length; i++) {
    if (x[i] < y[i]) return -1;
    if (x[i] > y[i]) return 1;
  }
  return 0;
}

function inlineText(token) {
  if (!token || !token.children) return token ? token.content : "";
  return token.children
    .filter((c) => c.type === "text" || c.type === "code_inline")
    .map((c) => c.content)
    .join("")
    .trim();
}

function truncate(s, n = 158) {
  s = s.replace(/\s+/g, " ").trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:.\s]+$/, "") + "…";
}

// Removes the "[Contents](README.md)" line that opens each chapter:
// the sidebar and breadcrumbs do that job here.
function stripContentsLine(tokens) {
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].type !== "paragraph_open") continue;
    const kids = tokens[i + 1].children || [];
    const isContents =
      kids.length === 3 &&
      kids[0].type === "link_open" &&
      kids[1].type === "text" &&
      /^contents$/i.test(kids[1].content.trim());
    if (isContents) {
      tokens.splice(i, 3);
      return;
    }
    if (i > 8) return; // only near the top
  }
}

function load() {
  const manifestPath = path.join(ROOT, "versions.json");
  if (!fs.existsSync(manifestPath)) {
    console.warn("[docs] no .cache/docs/versions.json: run `npm run fetch-docs` first. Building without docs.");
    return { versions: [], pages: [], redirects: [], latest: null, menuNote: "" };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const repo = manifest.repo;
  const versions = manifest.versions;
  const latest = versions.find((v) => v.latest) || versions[0];
  const released = versions.some((v) => v.kind === "release");

  // Where each version lives.
  for (const v of versions) {
    v.prefix = v.latest ? "/docs/" : `/docs/${v.id}/`;
    v.targets = v.latest ? ["/docs/", `/docs/${v.id}/`] : [v.prefix];
    v.title = v.codename ? `${v.label} “${v.codename}”` : v.label; // for titles and breadcrumbs
    v.files = walk(path.join(ROOT, v.id, "doc")).sort(cmp);
    v.paths = new Set(v.files.map(pagePathOf));
  }

  const broken = [];
  const pages = [];

  for (const v of versions) {
    const docRoot = path.join(ROOT, v.id, "doc");
    const fileToPath = new Map(v.files.map((f) => [f, pagePathOf(f)]));

    // Parse every file once per version.
    const parsed = v.files.map((rel) => {
      const src = fs.readFileSync(path.join(docRoot, rel), "utf8");
      return { rel, src, pagePath: fileToPath.get(rel) };
    });

    // Titles first: breadcrumbs and prev/next need every page's title.
    const titleOf = new Map();
    for (const p of parsed) {
      const m = /^#\s+(.+)$/m.exec(p.src);
      titleOf.set(p.rel, m ? m[1].replace(/[`*_]/g, "").trim() : p.pagePath || "Contents");
    }

    for (const target of v.targets) {
      const isCanonicalTree = target === "/docs/";
      parsed.forEach((p, idx) => {
        const dir = path.posix.dirname(p.rel) === "." ? "" : path.posix.dirname(p.rel);
        const url = target + (p.pagePath ? p.pagePath + "/" : "");

        const rewriteLink = (href) => {
          if (/^([a-z][a-z0-9+.-]*:|#|\/\/)/i.test(href)) return href;
          const hashAt = href.indexOf("#");
          const hrefPath = hashAt >= 0 ? href.slice(0, hashAt) : href;
          const hash = hashAt >= 0 ? href.slice(hashAt) : "";
          if (!hrefPath) return href;
          const inRepo = path.posix.normalize(path.posix.join("doc", dir, decodeURI(hrefPath)));
          if (inRepo.startsWith("doc/")) {
            const relTarget = inRepo.slice(4);
            if (fileToPath.has(relTarget)) {
              const tp = fileToPath.get(relTarget);
              return target + (tp ? tp + "/" : "") + hash;
            }
            if (!relTarget.endsWith(".md") && fs.existsSync(path.join(docRoot, relTarget))) {
              return `https://github.com/${repo}/blob/${v.refName}/${inRepo}${hash}`;
            }
            if (isCanonicalTree || v.targets.length === 1) broken.push(`${v.id}: doc/${p.rel} → ${href}`);
          }
          // Outside doc/ (CONFORMANCE.md, VERSIONING.md, …): link to GitHub at this version.
          return `https://github.com/${repo}/blob/${v.refName}/${inRepo}${hash}`;
        };

        const env = { rewriteLink };
        const tokens = md.parse(p.src, env);
        stripContentsLine(tokens);

        // Table of contents and description from the tokens.
        const toc = [];
        let description = "";
        let seenH1 = false;
        for (let i = 0; i < tokens.length; i++) {
          const t = tokens[i];
          if (t.type === "heading_open") {
            if (t.tag === "h1") seenH1 = true;
            if (t.tag === "h2" || t.tag === "h3") {
              toc.push({ level: Number(t.tag[1]), id: t.attrGet("id"), title: inlineText(tokens[i + 1]) });
            }
          }
          if (!description && seenH1 && t.type === "paragraph_open" && tokens[i + 1].type === "inline") {
            const text = inlineText(tokens[i + 1]);
            if (text.length > 40) description = truncate(text);
          }
        }
        const html = md.renderer.render(tokens, md.options, env);

        // Breadcrumbs: the set's contents, then each enclosing volume.
        const crumbs = [{ label: `turborel ${v.title} documentation`, url: target }];
        const parts = dir ? dir.split("/") : [];
        for (let n = 1; n <= parts.length; n++) {
          const d = parts.slice(0, n).join("/");
          const readme = v.files.find((f) => f.toLowerCase() === `${d}/readme.md`);
          if (readme && readme !== p.rel) crumbs.push({ label: titleOf.get(readme), url: target + fileToPath.get(readme) + "/" });
        }
        if (p.pagePath) crumbs.push({ label: titleOf.get(p.rel) });
        else crumbs[0] = { label: crumbs[0].label };

        const link = (j) =>
          j >= 0 && j < parsed.length
            ? { title: titleOf.get(parsed[j].rel), url: target + (parsed[j].pagePath ? parsed[j].pagePath + "/" : "") }
            : null;

        // The same page in every version, or that version's contents.
        const switcher = versions.map((w) => ({
          label: w.label,
          sub: w.sub,
          current: w.id === v.id,
          url: w.prefix + (w.paths.has(p.pagePath) && p.pagePath ? p.pagePath + "/" : ""),
        }));

        const latestHas = latest.paths.has(p.pagePath);
        const latestUrl = "/docs/" + (latestHas && p.pagePath ? p.pagePath + "/" : "");
        const canonical = isCanonicalTree ? url : latestHas ? latestUrl : url;

        let banner = null;
        if (v.kind === "alpha") {
          banner = {
            title: "Alpha",
            text: `These pages are built from ${v.refName}, turborel 0.0.0. Anything may change from one build to the next: SQL, API, protocol and files alike.`,
          };
        } else if (v.kind === "dev") {
          banner = {
            title: "Development version",
            text: `You are reading the documentation built from ${v.refName}, which may describe what no release has yet.`,
            link: { label: `Read this page for ${latest.label}${latest.codename ? " (" + latest.codename + ")" : ""}, the latest release.`, url: latestUrl },
          };
        } else if (!v.latest) {
          banner = {
            title: "Older release",
            text: `This is the documentation for ${v.label}, an earlier release.`,
            link: { label: `Read this page for ${latest.label}${latest.codename ? " (" + latest.codename + ")" : ""}, the latest release.`, url: latestUrl },
          };
        }

        pages.push({
          url,
          canonical,
          indexable: isCanonicalTree,
          noindex: v.kind === "dev",
          title: titleOf.get(p.rel),
          description: description || `${titleOf.get(p.rel)}: turborel ${v.label} documentation.`,
          html,
          toc,
          crumbs,
          prev: link(idx - 1),
          next: link(idx + 1),
          root: target,
          switcher,
          banner,
          // This page at its version's own address, for "Permanent link".
          permalink: `/docs/${v.id}/` + (p.pagePath ? p.pagePath + "/" : ""),
          permalinkNote:
            v.kind === "release"
              ? `This page in turborel ${v.title}; the link stays on this release after newer ones`
              : `This page as built from ${v.refName}; it changes as ${v.refName} does`,
          sourceUrl: `https://github.com/${repo}/blob/${v.refName}/doc/${p.rel}`,
          version: { id: v.id, label: v.label, title: v.title, codename: v.codename || null, sub: v.sub, kind: v.kind, sha: v.sha, date: v.date, refName: v.refName },
        });
      });
    }
  }

  if (broken.length) {
    const msg = `[docs] ${broken.length} link(s) to missing pages:\n  ` + [...new Set(broken)].join("\n  ");
    if (STRICT) throw new Error(msg);
    console.warn(msg);
  }
  console.log(`[docs] ${pages.length} pages across ${versions.length} version(s)`);
  // Once releases exist there is no alpha any more: its links, handed out
  // while it was the only version, go to the same page in dev (both are main).
  const redirects = [];
  const dev = versions.find((v) => v.kind === "dev");
  if (released && dev) {
    for (const pp of dev.paths) {
      const tail = pp ? pp + "/" : "";
      redirects.push({ from: `/docs/alpha/${tail}`, to: `/docs/dev/${tail}` });
    }
  }

  for (const v of versions) {
    delete v.files;
    delete v.paths;
  }

  return {
    versions,
    latest,
    pages,
    redirects,
    menuNote: released
      ? "One entry per release line, newest first; dev follows main."
      : "No releases yet: the docs follow main. Each GitHub release adds a version here.",
  };
}

export default load;
