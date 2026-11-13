// Every file here is a post: src/blog/posts/YYYY-MM-DD-some-slug.md
// becomes /blog/some-slug/, dated from its file name.
//
// Front matter:
//   title:       required
//   description: one or two sentences, used for search engines and the feed
//   author / authors: optional, one key or a list of keys from
//                src/_data/people.js (name + website), e.g. authors: [ada, grace];
//                defaults to "Turborel contributors"
//   cover:       optional cover image, also the post's share picture
//                (og:image). A bare file name is looked up in
//                src/blog/images/, e.g. cover: launch.jpg; a path starting
//                with / or a full URL is used as is. Best at 1200×630.
//   coverAlt:    what the cover shows, for screen readers (needed with cover)
//   coverCaption: optional caption under it
//   coverCredit: optional, who made the image (artist, photographer…)
//   coverCreditUrl:  their site or profile
//   coverSource:     optional, where it came from, e.g. Unsplash, Wikimedia Commons
//   coverSourceUrl:  the image's page there
//   coverLicense:    optional, e.g. CC BY 4.0
//   coverLicenseUrl: the license's page
//   coverCreditLabel: optional, the words before the name (default "Image by";
//                "Photo by", "Illustration by", …)
//                -> "Image by Jane Doe via Unsplash · CC BY 4.0", each linked
//   attachments: optional files listed at the bottom of the post. Each is a
//                file name in src/blog/files/ (a sub-folder per post keeps
//                them apart: 2026-launch/results.csv), a path starting with
//                /, or a full URL; as is, or with a title and a line about it:
//                  attachments:
//                    - launch/results.csv
//                    - file: launch/slides.pdf
//                      title: Slides from the talk
//                      description: 24 pages, with speaker notes.
//                Type and size are filled in from the file.
//   tags:        optional list, e.g. [releases, sql]
//   draft: true  shown by `npm start`, left out of the published site
import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";

const isProd = process.env.ELEVENTY_RUN_MODE === "build";

// The post's authors as [{ name, url }], from author/authors in its front
// matter: keys into people.js, plain names, or inline { name, url }.
function postAuthors(data) {
  let list = data.authors ?? data.author;
  if (list == null || list === "" || (Array.isArray(list) && !list.length)) {
    return [{ name: data.site.author, url: null, group: true }];
  }
  if (!Array.isArray(list)) list = [list];
  return list
    .map((a) => {
      if (typeof a === "string") {
        const p = (data.people || {})[a];
        return p ? { name: p.name, url: p.url || null } : { name: a, url: null };
      }
      return { name: a && a.name, url: (a && a.url) || null };
    })
    .filter((a) => a.name);
}

function coverSrc(cover) {
  if (!cover) return null;
  if (/^(https?:)?\/\//.test(cover) || cover.startsWith("/")) return cover;
  return `/blog/images/${cover}`;
}

// The cover's credit line, or null: who made it, where it's from, its license.
function coverCredit(data) {
  if (!data.cover) return null;
  const c = {
    label: data.coverCreditLabel || "Image by",
    name: data.coverCredit || null,
    url: data.coverCreditUrl || null,
    source: data.coverSource || null,
    sourceUrl: data.coverSourceUrl || null,
    license: data.coverLicense || null,
    licenseUrl: data.coverLicenseUrl || null,
  };
  if (!c.name && !c.source && !c.license) return null;
  // Plain text, for the feed and search engines.
  c.text = [
    [c.name ? `${c.label} ${c.name}` : null, c.source ? (c.name ? `via ${c.source}` : `From ${c.source}`) : null]
      .filter(Boolean)
      .join(" "),
    c.license,
  ]
    .filter(Boolean)
    .join(" · ");
  return c;
}

const MIME = {
  pdf: "application/pdf", csv: "text/csv", tsv: "text/tab-separated-values", txt: "text/plain",
  md: "text/markdown", json: "application/json", sql: "application/sql", xml: "application/xml",
  zip: "application/zip", gz: "application/gzip", tgz: "application/gzip", tar: "application/x-tar",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

function sizeLabel(bytes) {
  if (bytes == null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// The post's attachments as [{ title, url, description, ext, type, size, sizeLabel }].
function postAttachments(data) {
  const list = Array.isArray(data.attachments) ? data.attachments : data.attachments ? [data.attachments] : [];
  return list
    .map((a) => {
      const entry = typeof a === "string" ? { file: a } : a || {};
      const ref = entry.file || entry.url;
      if (!ref) return null;
      const external = /^(https?:)?\/\//.test(ref);
      const url = external || ref.startsWith("/") ? ref : `/blog/files/${ref}`;
      const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || ref);
      const ext = (name.includes(".") ? name.split(".").pop() : "").toLowerCase();
      let size = null;
      if (!external) {
        const onDisk = path.join("src", decodeURIComponent(url));
        try {
          size = fs.statSync(onDisk).size;
        } catch {
          // Left off the page rather than shown as a broken link.
          console.warn(`[blog] ${data.page.inputPath}: attachment ${ref} not found (looked for ${onDisk}); not listed`);
          return null;
        }
      }
      return {
        title: entry.title || name,
        url,
        description: entry.description || null,
        ext: ext ? ext.toUpperCase() : null,
        type: MIME[ext] || null,
        size,
        sizeLabel: sizeLabel(size),
        external,
      };
    })
    .filter(Boolean);
}

// The cover for search engines: an ImageObject with its credit and license.
function imageObject(data) {
  const url = new URL(coverSrc(data.cover), data.site.url).href;
  const c = coverCredit(data);
  if (!c && !data.coverCaption) return url;
  return {
    "@type": "ImageObject",
    url,
    ...(data.coverCaption ? { caption: data.coverCaption } : {}),
    ...(c && c.text ? { creditText: c.text } : {}),
    ...(c && c.name ? { creator: { "@type": "Person", name: c.name, ...(c.url ? { url: c.url } : {}) } } : {}),
    ...(c && c.licenseUrl ? { license: c.licenseUrl } : {}),
    ...(c && c.sourceUrl ? { acquireLicensePage: c.sourceUrl } : {}),
  };
}

export default {
  layout: "post.njk",
  eleventyComputed: {
    permalink: (data) => (isProd && data.draft ? false : `/blog/${data.page.fileSlug}/`),
    metaTitle: (data) => `${data.title} — turborel blog`,
    postAuthors,
    coverSrc: (data) => coverSrc(data.cover),
    ogImage: (data) => coverSrc(data.cover),
    ogImageAlt: (data) => (data.cover ? data.coverAlt || "" : ""),
    coverCreditInfo: coverCredit,
    postAttachments,
    canonical: (data) => `/blog/${data.page.fileSlug}/`,
    crumbs: (data) => [
      { label: "turborel blog", url: "/blog/" },
      { label: String(data.page.date.getUTCFullYear()), url: `/blog/#y${data.page.date.getUTCFullYear()}` },
      { label: data.title },
    ],
    related: () => [
      { label: "all posts", url: "/blog/" },
      { label: "atom feed", url: "/blog/feed.xml" },
    ],
    // Headings of the post for the sidebar, read from its Markdown source.
    postToc: (data) => {
      const raw = data.page.rawInput || "";
      const slugger = new GithubSlugger();
      const out = [];
      let fenced = false;
      for (const line of raw.split("\n")) {
        if (/^(```|~~~)/.test(line)) fenced = !fenced;
        if (fenced) continue;
        const m = /^(#{1,3})\s+(.+?)\s*#*\s*$/.exec(line);
        if (!m) continue;
        const text = m[2].replace(/[`*_]/g, "");
        const id = slugger.slug(text);
        if (m[1].length >= 2) out.push({ level: m[1].length, id, title: text });
      }
      return out;
    },
    jsonld: (data) => {
      const url = new URL(`/blog/${data.page.fileSlug}/`, data.site.url).href;
      return {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: data.title,
        description: data.description,
        url,
        mainEntityOfPage: url,
        datePublished: data.page.date.toISOString(),
        author: postAuthors(data).map((a) => ({
          "@type": a.group ? "Organization" : "Person",
          name: a.name,
          ...(a.url ? { url: a.url } : {}),
        })),
        ...(data.cover ? { image: imageObject(data) } : {}),
        publisher: {
          "@type": "Organization",
          name: "turborel",
          url: data.site.url,
          logo: new URL("/assets/android-chrome-512x512.png", data.site.url).href,
        },
        keywords: (data.tags || []).join(", "),
      };
    },
  },
};
