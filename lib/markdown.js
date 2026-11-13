// One Markdown renderer for the docs and the blog, so both read the same:
// GitHub-style heading ids, Sphinx-style ¶ links, and syntax highlighting
// done at build time with Prism (no JavaScript in the browser).
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import GithubSlugger from "github-slugger";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";

loadLanguages(["sql", "rust", "toml", "bash", "json", "yaml", "diff", "ini"]);

const ALIASES = { sh: "bash", shell: "bash", console: "bash", rs: "rust", yml: "yaml" };

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function highlight(code, lang) {
  const name = ALIASES[lang] || lang;
  if (name && Prism.languages[name]) {
    const html = Prism.highlight(code, Prism.languages[name], name);
    return `<pre class="code language-${name}"><code>${html}</code></pre>`;
  }
  // Unlabelled blocks in the manuals are program output and terminal
  // sessions: shown plainly, set apart from code.
  const cls = name ? `code language-${escapeHtml(name)}` : "code output";
  return `<pre class="${cls}"><code>${escapeHtml(code)}</code></pre>`;
}

export function createMarkdown() {
  const md = new MarkdownIt({
    html: false, // the manuals write SQL syntax like <name> in prose
    linkify: false,
    typographer: false,
    highlight,
  });

  // Ids as GitHub makes them, so in-page links written for GitHub
  // (#a-databases-directory) keep working here. One slugger per document.
  const slugger = new GithubSlugger();
  md.core.ruler.before("normalize", "reset_slugger", () => {
    slugger.reset();
  });

  md.use(anchor, {
    level: [1, 2, 3, 4],
    slugify: (s) => slugger.slug(s),
    permalink: anchor.permalink.ariaHidden({
      placement: "after",
      symbol: "¶",
      class: "headerlink",
      renderAttrs: () => ({ "data-pagefind-ignore": "" }), // keep ¶ out of search results
    }),
  });

  // Tables can be wide: give each a scrolling box.
  md.renderer.rules.table_open = () => '<div class="table-wrap"><table>\n';
  md.renderer.rules.table_close = () => "</table></div>\n";

  // Link rewriting is supplied per document through env.rewriteLink.
  md.core.ruler.push("rewrite_links", (state) => {
    const rewrite = state.env && state.env.rewriteLink;
    if (!rewrite) return;
    for (const block of state.tokens) {
      if (block.type !== "inline" || !block.children) continue;
      for (const t of block.children) {
        if (t.type !== "link_open") continue;
        const href = t.attrGet("href");
        if (href) t.attrSet("href", rewrite(href));
      }
    }
  });

  return md;
}
