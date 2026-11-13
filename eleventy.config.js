import { HtmlBasePlugin } from "@11ty/eleventy";
import rssPlugin from "@11ty/eleventy-plugin-rss";
import { createMarkdown } from "./lib/markdown.js";
import { icon, shareTargets, socialLinks } from "./lib/icons.js";
import site from "./src/_data/site.js";

export default function (eleventyConfig) {
  // Blog posts use the same renderer as the docs: same highlighting, same ¶ links.
  eleventyConfig.setLibrary("md", createMarkdown());

  // The home page (src/home.html) is a template too, so it can list the
  // latest posts and releases; its front matter publishes it as /index.html.
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/blog/images": "blog/images" }); // post covers
  eleventyConfig.addPassthroughCopy({ "src/blog/files": "blog/files" }); // post attachments
  eleventyConfig.ignores.add("src/blog/files/**"); // copied as is, never rendered (.md, .html…)
  eleventyConfig.ignores.add("src/blog/images/**");
  eleventyConfig.addPassthroughCopy("CNAME");

  eleventyConfig.addFilter("abs", (url) => new URL(url || "/", site.url).href);
  eleventyConfig.addFilter("jsonld", (obj) => JSON.stringify(obj).replace(/</g, "\\u003c"));
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString());
  eleventyConfig.addFilter("longDate", (d) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("tagSlug", (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  eleventyConfig.addFilter("year", (d) => new Date(d).getUTCFullYear());
  eleventyConfig.addFilter("readingTime", (html) => {
    const words = String(html || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 220));
  });
  // "A", "A and B", "A, B and C", each linked to their site when they have one.
  eleventyConfig.addFilter("authorLinks", (authors) => {
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const safeUrl = (u) => (u && /^(https?:\/\/|\/|mailto:)/i.test(u) ? u : null);
    const parts = (authors || []).map((a) =>
      safeUrl(a.url) ? `<a href="${esc(a.url)}" rel="author noopener" target="_blank">${esc(a.name)}</a>` : esc(a.name)
    );
    return parts.length < 2 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  });
  // Links in a post open in a new tab, so following one doesn't lose your
  // place: every <a href> except jumps within the page (#…) and ¶ links.
  eleventyConfig.addFilter("newTabLinks", (html) =>
    String(html || "").replace(/<a\s([^>]*)>/gi, (tag, attrs) => {
      if (!/\bhref\s*=/i.test(attrs) || /\bhref\s*=\s*["']#/i.test(attrs) || /\btarget\s*=/i.test(attrs)) return tag;
      if (/\bclass\s*=\s*["'][^"']*\bheaderlink\b/i.test(attrs)) return tag;
      let a = attrs;
      if (/\brel\s*=\s*"/i.test(a)) a = a.replace(/\brel\s*=\s*"([^"]*)"/i, (m, v) => `rel="${v.includes("noopener") ? v : (v + " noopener").trim()}"`);
      else a += ' rel="noopener"';
      return `<a ${a} target="_blank">`;
    })
  );
  eleventyConfig.addFilter("icon", icon); // {{ "x" | icon | safe }}
  eleventyConfig.addFilter("shareTargets", shareTargets);
  eleventyConfig.addFilter("socialLinks", socialLinks);
  eleventyConfig.addFilter("postTags", (tags) => (tags || []).filter((t) => t !== "posts"));
  eleventyConfig.addFilter("byYear", (posts) => {
    const years = new Map();
    for (const p of posts) {
      const y = p.date.getUTCFullYear();
      years.set(y, (years.get(y) || 0) + 1);
    }
    return [...years.entries()].sort((a, b) => b[0] - a[0]).map(([year, count]) => ({ year, count }));
  });

  const isProd = process.env.ELEVENTY_RUN_MODE === "build";
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/blog/posts/*.md")
      .filter((p) => !(isProd && p.data.draft))
      .sort((a, b) => a.date - b.date)
  );
  eleventyConfig.addCollection("blogTags", (api) => {
    const tags = new Set();
    for (const p of api.getFilteredByGlob("src/blog/posts/*.md")) {
      if (isProd && p.data.draft) continue;
      for (const t of p.data.tags || []) if (t !== "posts") tags.add(t);
    }
    return [...tags].sort();
  });

  // The Atom feed is src/blog/feed.njk (so each entry can name its own
  // authors); these give it its date and absolute-URL filters.
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPlugin(rssPlugin);

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    markdownTemplateEngine: false, // posts may show {{ }} in code; keep Markdown literal
    htmlTemplateEngine: "njk",
  };
}
