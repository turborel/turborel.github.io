#!/usr/bin/env node
// Collects the doc/ folder of turborel/turborel for every version the
// site shows, into .cache/docs/<version>/doc, and writes
// .cache/docs/versions.json for the build, plus .cache/docs/releases.json
// (every release, newest first) for the home page.
//
// Versions come from GitHub releases:
//   - no releases yet  -> one version, "alpha", built from main
//   - releases         -> newest patch of each MAJOR.MINOR (newest first,
//                         the first is "latest"), plus "dev" from main
//
// Environment:
//   DOCS_REPO                 owner/name (default turborel/turborel)
//   DOCS_BRANCH               development branch (default main)
//   DOCS_LOCAL                path to a local clone to read instead of fetching
//   DOCS_RELEASE_SOURCE       "releases" (default) or "tags"
//   DOCS_INCLUDE_PRERELEASES  "1" to list GitHub pre-releases too
//   DOCS_MAX_VERSIONS         most release lines listed (default 8)
//   GITHUB_TOKEN / GH_TOKEN   used for the releases API when set

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = process.env.DOCS_REPO || "turborel/turborel";
const BRANCH = process.env.DOCS_BRANCH || "main";
const OUT = path.resolve(".cache/docs");
const CLONE = path.resolve(".cache/repo");
const MAX = Number(process.env.DOCS_MAX_VERSIONS || 8);
const INCLUDE_PRE = process.env.DOCS_INCLUDE_PRERELEASES === "1";
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

function git(cwd, args, opts = {}) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: opts.buffer ? null : "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(cwd, args) {
  try {
    return git(cwd, args).trim();
  } catch {
    return null;
  }
}

function parse(tag) {
  const m = SEMVER.exec(tag);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], pre: m[4] || null };
}

function compare(a, b) {
  return (
    a.major - b.major ||
    a.minor - b.minor ||
    a.patch - b.patch ||
    (a.pre === b.pre ? 0 : a.pre === null ? 1 : b.pre === null ? -1 : a.pre < b.pre ? -1 : 1)
  );
}

// --- the source repository -------------------------------------------------

let src;
let mainRef;
if (process.env.DOCS_LOCAL) {
  src = path.resolve(process.env.DOCS_LOCAL);
  mainRef = tryGit(src, ["rev-parse", "--verify", `origin/${BRANCH}`]) ? `origin/${BRANCH}` : "HEAD";
  console.log(`docs: reading local clone ${src} (${mainRef})`);
} else {
  src = CLONE;
  const url = `https://github.com/${REPO}.git`;
  if (fs.existsSync(path.join(src, ".git")) || fs.existsSync(path.join(src, "HEAD"))) {
    console.log(`docs: fetching ${url}`);
    git(src, ["fetch", "--force", "--tags", "--prune", "origin", `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`]);
  } else {
    console.log(`docs: cloning ${url}`);
    fs.mkdirSync(path.dirname(src), { recursive: true });
    execFileSync("git", ["clone", "--filter=blob:none", "--no-checkout", "--branch", BRANCH, url, src], {
      stdio: ["ignore", "inherit", "inherit"],
    });
  }
  mainRef = `origin/${BRANCH}`;
}

// --- releases --------------------------------------------------------------

async function releasesFromGitHub() {
  const headers = { Accept: "application/vnd.github+json", "User-Agent": "turborel-site" };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
    const batch = await res.json();
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all
    .filter((r) => !r.draft && (INCLUDE_PRE || !r.prerelease))
    .map((r) => ({
      tag: r.tag_name, name: r.name || "", prerelease: r.prerelease,
      date: r.published_at || r.created_at, url: r.html_url,
    }));
}

function releasesFromTags() {
  const out = tryGit(src, ["tag", "--list"]) || "";
  return out
    .split("\n")
    .filter(Boolean)
    .filter((t) => {
      const v = parse(t);
      return v && (INCLUDE_PRE || !v.pre);
    })
    .map((t) => ({
      tag: t, name: "", prerelease: !!parse(t).pre,
      date: tryGit(src, ["log", "-1", "--format=%cI", `refs/tags/${t}`]),
      url: `https://github.com/${REPO}/releases/tag/${encodeURIComponent(t)}`,
    }));
}

let releases;
if (process.env.DOCS_RELEASE_SOURCE === "tags") {
  releases = releasesFromTags();
  console.log(`docs: ${releases.length} release tag(s) from git`);
} else {
  try {
    releases = await releasesFromGitHub();
    console.log(`docs: ${releases.length} GitHub release(s)`);
  } catch (err) {
    console.warn(`docs: could not read GitHub releases (${err.message}); using git tags`);
    releases = releasesFromTags();
  }
}

function codename(release) {
  // "1.0.0 Sprout", "v1.0.0 — Sprout", "Sprout" -> "Sprout"
  const rest = release.name
    .replace(release.tag, "")
    .replace(/^\s*v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/, "")
    .replace(/^[\s\-–—:(]+|[\s)]+$/g, "");
  return rest || null;
}

// Newest patch of each MAJOR.MINOR.
const lines = new Map();
for (const r of releases) {
  const v = parse(r.tag);
  if (!v) continue;
  const key = `${v.major}.${v.minor}`;
  const have = lines.get(key);
  if (!have || compare(v, have.v) > 0) lines.set(key, { ...r, v, key });
}
const picked = [...lines.values()].sort((a, b) => compare(b.v, a.v)).slice(0, MAX);

// Make sure every picked tag is present locally.
for (const r of picked) {
  if (!tryGit(src, ["rev-parse", "--verify", `refs/tags/${r.tag}^{commit}`])) {
    git(src, ["fetch", "--force", "origin", `+refs/tags/${r.tag}:refs/tags/${r.tag}`]);
  }
}

// --- versions --------------------------------------------------------------

function info(ref) {
  return {
    sha: git(src, ["rev-parse", "--short", `${ref}^{commit}`]).trim(),
    date: git(src, ["log", "-1", "--format=%cI", ref]).trim(),
  };
}

const versions = [];
if (picked.length === 0) {
  const i = info(mainRef);
  versions.push({
    id: "alpha", label: "alpha", kind: "alpha", latest: true,
    ref: mainRef, refName: BRANCH, ...i, sub: `${BRANCH} · ${i.sha}`,
  });
} else {
  picked.forEach((r, n) => {
    const ref = `refs/tags/${r.tag}`;
    const name = codename(r);
    const version = `${r.v.major}.${r.v.minor}.${r.v.patch}${r.v.pre ? "-" + r.v.pre : ""}`;
    const sub = [name, version, n === 0 ? "latest" : null].filter(Boolean).join(" · ");
    versions.push({
      id: r.key, label: r.key, kind: "release", latest: n === 0,
      ref, refName: r.tag, codename: name, version, ...info(ref), sub,
    });
  });
  const i = info(mainRef);
  versions.push({
    id: "dev", label: "dev", kind: "dev", latest: false,
    ref: mainRef, refName: BRANCH, ...i, sub: `${BRANCH} · ${i.sha}`,
  });
}

// --- extract doc/ for each version ------------------------------------------

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const v of versions) {
  const dir = path.join(OUT, v.id);
  fs.mkdirSync(dir, { recursive: true });
  if (!tryGit(src, ["cat-file", "-t", `${v.ref}:doc`])) {
    console.warn(`docs: ${v.refName} has no doc/ folder; skipped`);
    v.empty = true;
    continue;
  }
  const tar = git(src, ["archive", "--format=tar", v.ref, "doc"], { buffer: true });
  execFileSync("tar", ["-x", "-C", dir], { input: tar });
  console.log(`docs: ${v.label.padEnd(6)} ← ${v.refName} @ ${v.sha}`);
}

// Every release, newest first, for the home page's "Releases" list.
const releaseList = releases
  .map((r) => ({ ...r, v: parse(r.tag) }))
  .filter((r) => r.v)
  .sort((a, b) => compare(b.v, a.v))
  .map(({ v, ...r }) => ({
    ...r,
    version: `${v.major}.${v.minor}.${v.patch}${v.pre ? "-" + v.pre : ""}`,
    codename: codename(r),
  }));
fs.writeFileSync(path.join(OUT, "releases.json"), JSON.stringify(releaseList, null, 2));
console.log(`docs: releases.json lists ${releaseList.length} release(s)`);

fs.writeFileSync(
  path.join(OUT, "versions.json"),
  JSON.stringify({ repo: REPO, branch: BRANCH, generatedAt: new Date().toISOString(), versions: versions.filter((v) => !v.empty) }, null, 2)
);
