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
// The drivers' and Studio's docs (fetched into .cache/docs/<version>/sets/)
// are sets of their own inside each version, under their docs path:
//   /docs/drivers/python/user/connecting/, /docs/0.1/drivers/python/...
// each with its own contents, previous and next, and source links.
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

  // Where each version lives, and its sets: the server's docs, then each
  // driver's and Studio's. A set's pages sit under its base path.
  const join = (base, pp) => [base, pp].filter(Boolean).join("/");
  for (const v of versions) {
    v.prefix = v.latest ? "/docs/" : `/docs/${v.id}/`;
    v.targets = v.latest ? ["/docs/", `/docs/${v.id}/`] : [v.prefix];
    v.title = v.codename ? `${v.label} “${v.codename}”` : v.label; // for titles and breadcrumbs
    v.docSets = [
      { base: "", main: true, name: "Turborel", repo, refName: v.refName, sha: v.sha, date: v.date, root: path.join(ROOT, v.id, "doc") },
      ...(v.sets || []).map((x) => ({ ...x, base: x.path, root: path.join(ROOT, v.id, "sets", x.path, "doc") })),
    ];
    for (const set of v.docSets) set.files = walk(set.root).sort(cmp);
    v.paths = new Set(v.docSets.flatMap((set) => set.files.map((f) => join(set.base, pagePathOf(f)))));
  }

  const broken = [];
  const pages = [];

  // Links on GitHub into the doc/ of a repo published here (the drivers cite
  // the server's manuals, the server's Ecosystem volume the operator's guides)
  // go to the same page here.
  const GITHUB_DOC = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/blob\/[^/]+\/doc\/([^#?]+\.md)(#.*)?$/;

  for (const v of versions) {
   // Each published repo's files, by the page paths they are at here.
   const repoFiles = new Map(v.docSets.map((s) => [s.repo, new Map(s.files.map((f) => [f, join(s.base, pagePathOf(f))]))]));
   for (const set of v.docSets) {
    const docRoot = set.root;
    const fileToPath = new Map(set.files.map((f) => [f, join(set.base, pagePathOf(f))]));
    const setRoot = set.base ? set.base + "/" : "";
    const installing = [...fileToPath.values()].find((pp) => pp === join(set.base, "user/installing"));
    const setTitle = set.main ? `Turborel ${v.title} documentation` : `${set.name} ${v.title} documentation`;

    // Parse every file once per version.
    const parsed = set.files.map((rel) => {
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
          const gm = GITHUB_DOC.exec(href);
          if (gm && repoFiles.has(gm[1]) && repoFiles.get(gm[1]).has(decodeURI(gm[2]))) {
            const tp = repoFiles.get(gm[1]).get(decodeURI(gm[2]));
            return target + (tp ? tp + "/" : "") + (gm[3] || "");
          }
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
              return `https://github.com/${set.repo}/blob/${set.refName}/${inRepo}${hash}`;
            }
            if (isCanonicalTree || v.targets.length === 1) broken.push(`${v.id}: ${set.main ? "" : set.repo + " "}doc/${p.rel} → ${href}`);
          }
          // Outside doc/ (CONFORMANCE.md, VERSIONING.md, …): link to GitHub at this version.
          return `https://github.com/${set.repo}/blob/${set.refName}/${inRepo}${hash}`;
        };

        // Images in doc/ are copied to /docs/<version>/<set>/… by the build
        // (eleventy.config.js), one copy per version that every tree of it
        // shares. An image shows only in one theme when its src ends in
        // GitHub's #gh-light-mode-only or #gh-dark-mode-only (Studio's
        // screenshots come in such pairs), or else when it is named
        // *-light.* or *-dark.*. In that older form the dark one's alt is
        // often "The same, in the dark theme"; it takes its twin's alt.
        const lightAlt = new Map();
        const rewriteImage = (token, state) => {
          let src = token.attrGet("src");
          if (!src) return;
          const marker = /#gh-(light|dark)-mode-only$/i.exec(src);
          if (marker) {
            src = src.slice(0, marker.index);
            token.attrSet("src", src);
          }
          if (/^([a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(src)) {
            if (marker) token.attrJoin("class", `only-${marker[1].toLowerCase()}`);
            return;
          }
          const inRepo = path.posix.normalize(path.posix.join("doc", dir, decodeURI(src)));
          const relTarget = inRepo.slice(4);
          if (!inRepo.startsWith("doc/") || !fs.existsSync(path.join(docRoot, relTarget))) {
            if (isCanonicalTree || v.targets.length === 1) broken.push(`${v.id}: ${set.main ? "" : set.repo + " "}doc/${p.rel} → image ${src}`);
            token.attrSet("src", `https://raw.githubusercontent.com/${set.repo}/${set.refName}/${inRepo}`);
            return;
          }
          token.attrSet("src", encodeURI(`/docs/${v.id}/${join(set.base, relTarget)}`));
          token.attrSet("loading", "lazy");
          const named = /^(.*)-(light|dark)\.[a-z0-9]+$/i.exec(relTarget);
          const theme = (marker ? marker[1] : named ? named[2] : "").toLowerCase();
          if (!theme) return;
          token.attrJoin("class", `only-${theme}`);
          if (!named) return;
          const stem = named[1];
          const alt = token.children.map((c) => c.content).join("");
          if (theme === "light") lightAlt.set(stem, alt);
          else if (lightAlt.has(stem) && /^the same\b/i.test(alt)) {
            const text = new state.Token("text", "", 0);
            text.content = lightAlt.get(stem).replace(/\blight theme\b/i, "dark theme");
            token.children = [text];
          }
        };

        const env = { rewriteLink, rewriteImage };
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
        const crumbs = [{ label: `Turborel ${v.title} documentation`, url: target }];
        if (!set.main) crumbs.push({ label: set.label, url: target + setRoot });
        const parts = dir ? dir.split("/") : [];
        for (let n = 1; n <= parts.length; n++) {
          const d = parts.slice(0, n).join("/");
          const readme = set.files.find((f) => f.toLowerCase() === `${d}/readme.md`);
          if (readme && readme !== p.rel) crumbs.push({ label: titleOf.get(readme), url: target + fileToPath.get(readme) + "/" });
        }
        const isRoot = p.pagePath === set.base;
        if (!isRoot) crumbs.push({ label: titleOf.get(p.rel) });
        else crumbs[crumbs.length - 1] = { label: crumbs[crumbs.length - 1].label };

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
            text: `These pages are built from ${set.main ? "" : set.name + "’s "}${set.refName}, Turborel 0.0.0. Anything may change from one build to the next: SQL, API, protocol and files alike.`,
          };
        } else if (v.kind === "dev") {
          banner = {
            title: "Development version",
            text: `You are reading the documentation built from ${set.main ? "" : set.name + "’s "}${set.refName}, which may describe what no release has yet.`,
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
          setTitle,
          isRoot,
          description: description || `${titleOf.get(p.rel)}: ${setTitle}.`,
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
              ? `This page in Turborel ${v.title}; the link stays on this release after newer ones`
              : `This page as built from ${set.refName}; it changes as ${set.refName} does`,
          sourceUrl: `https://github.com/${set.repo}/blob/${set.refName}/doc/${p.rel}`,
          source: { repo: set.repo, refName: set.refName, sha: set.sha, date: set.date },
          // A driver's or Studio's own links, for the sidebar.
          setNav: set.main ? null : { label: set.label, repo: set.repo, home: target + setRoot, installing: installing ? target + installing + "/" : null },
          // On the server docs' contents page: the drivers' and Studio's docs.
          // The drivers by language, then the tools (Studio, the operator).
          sets: set.main && isRoot ? (() => {
            const others = v.docSets.filter((x) => !x.main);
            const link = (x, label) => ({ label, url: target + x.base + "/" });
            return [
              { title: "Drivers", items: others.filter((x) => x.base.startsWith("drivers/")).map((x) => link(x, x.label.replace(/ driver$/, ""))) },
              { title: "Tools", items: others.filter((x) => !x.base.startsWith("drivers/")).map((x) => link(x, x.label)) },
            ].filter((g) => g.items.length);
          })() : null,
          version: { id: v.id, label: v.label, title: v.title, codename: v.codename || null, sub: v.sub, kind: v.kind, sha: v.sha, date: v.date, refName: v.refName },
        });
      });
    }
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
    delete v.docSets;
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
