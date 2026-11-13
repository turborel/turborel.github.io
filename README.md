# turborel web

The home page, the documentation and the blog of
[turborel](https://github.com/turborel/turborel), built with
[Eleventy](https://www.11ty.dev/) and published by GitHub Pages.

- Home - `src/home.html`, published as `/index.html`. Hand-written, except
  for the "From the blog" and "Releases" lists under the hero, which are
  filled in at build time (how many of each: `homePosts` and `homeReleases`
  in `src/_data/site.js`). Releases come from turborel's GitHub releases,
  read by `npm run fetch-docs`.
- Docs - built from the `doc/` folder of `turborel/turborel`, once per
  version: the latest at `/docs/`, every version also at
  `/docs/<version>/` (see [How versions work](#how-versions-work)).
- Blog - Markdown files in `src/blog/posts/`, at `/blog/`, with an Atom
  feed at `/blog/feed.xml`. Posts can have several authors, a cover image
  with a credit line, and attached files (see
  [Writing a blog post](#writing-a-blog-post)).

## Deploying

One-time setup, about ten minutes.

### 1. Turn on Pages from Actions

In **turborel.github.io → Settings → Pages**, set **Source** to
**GitHub Actions**. The custom domain `turborel.com` stays as it is (the
`CNAME` file is still published too).

### 2. Push

```sh
git push
```

The **Deploy site** workflow (Actions tab) builds and publishes. The site
then rebuilds on every push here, every night, and whenever you run it
from the Actions tab.

### 3. Rebuild when the docs change (in turborel/turborel)

So that an edit to `doc/` or a new release shows up at once rather than
the next night:

1. Create a fine-grained personal access token
   (**GitHub → Settings → Developer settings → Fine-grained tokens**):
   resource owner **turborel**, repository **turborel.github.io** only,
   permission **Contents: Read and write**.
2. In **turborel/turborel → Settings → Secrets and variables → Actions**,
   add it as `SITE_DISPATCH_TOKEN`.
3. Copy `extras/turborel-repo/.github/workflows/docs-site.yml` into
   `turborel/turborel` at `.github/workflows/docs-site.yml` and push.

You can delete `extras/` from this repository afterwards.

## How versions work

`scripts/fetch-docs.js` reads the GitHub releases of `turborel/turborel`:

| Releases | Versions in the menu | URLs |
|---|---|---|
| none (today) | **alpha**, from `main` | `/docs/…`, also at `/docs/alpha/…` |
| some | the newest patch of each `MAJOR.MINOR`, newest first, then **dev** from `main` | `/docs/…` is the latest release, also at `/docs/1.0/…`; older at `/docs/0.9/…`; `/docs/dev/…` |

`/docs/…` always shows the latest version, for short links. The
`/docs/<version>/…` address of a page is its permanent link (the
**Permanent link** item under **This Page** in the sidebar): for a release
it keeps showing that release after newer ones come out. Once the first
release is out there is no alpha any more, and every `/docs/alpha/…`
address redirects to the same page under `/docs/dev/…` (both are `main`).

- Publishing a release on GitHub is all it takes; draft releases are
  ignored, and pre-releases unless `DOCS_INCLUDE_PRERELEASES=1`.
- Tags must look like `v1.2.3` or `1.2.3`.
- A release's codename comes from its title: name the release
  `1.0.0 Sprout` and the menu shows `1.0 · Sprout · 1.0.0 · latest`, and
  page titles and breadcrumbs say `turborel 1.0 “Sprout” documentation`.
  Codenames never appear in URLs.
- The home page's **Releases** list comes from the same releases
  (`fetch-docs` writes them to `.cache/docs/releases.json`). Until the
  first one it says turborel is in alpha and links the current `main`
  commit.
- Every version is rebuilt on every deploy, so a change to the design
  reaches old versions too.
- The menu keeps you on the same page in another version, or takes you to
  that version's contents if the page doesn't exist there.

Numbers are dropped from URLs, so reordering chapters doesn't break links:
`doc/user/02-getting-started.md` → `/docs/user/getting-started/`, and
`doc/appendix/f-versions.md` → `/docs/appendix/versions/`. `README.md` is
the contents page of its folder. Links between `.md` files are rewritten to
these URLs; links out of `doc/` (to `CONFORMANCE.md`, `VERSIONING.md`) go
to GitHub at the same version.

## SEO

- `/docs/…` is the one indexed copy. Every other version's page names it
  as canonical, `dev` pages are `noindex`, and so are the `/docs/alpha/…`
  redirects.
- `sitemap.xml` lists the home page, `/docs/…` and the blog; `robots.txt`
  points to it.
- Each page has a description (the first paragraph), Open Graph tags, and
  JSON-LD: `TechArticle` and `BreadcrumbList` for docs, `BlogPosting` for
  posts (with every author, and the cover with its credit and license).
- A post's cover is its share picture (`og:image`, and a large card on
  X); pages without one use the logo.
- Pages are plain HTML. Code is highlighted at build time; the version menu
  works without JavaScript. Only search uses it.
- Search is [Pagefind](https://pagefind.app/), indexed at build time:
  the latest docs and the blog.

## Writing a blog post

Add `src/blog/posts/YYYY-MM-DD-a-short-slug.md`:

~~~markdown
---
title: Three servers, one log
description: How replication elects a new primary. One or two sentences.
authors: [jane, sam]    # optional; one person: author: jane
tags: [replication]     # optional
draft: true             # optional: shown locally, not published
cover: replication.jpg  # optional, from src/blog/images/
coverAlt: Three servers passing a log between them
coverCredit: Jane Doe                 # optional credit line, each part
coverCreditUrl: https://example.com   # linked when given a URL
coverSource: Unsplash
coverSourceUrl: https://unsplash.com/photos/…
coverLicense: CC BY 4.0
coverLicenseUrl: https://creativecommons.org/licenses/by/4.0/
attachments:            # optional, from src/blog/files/
  - replication/benchmarks.csv
  - file: replication/slides.pdf
    title: Slides from the talk
    description: 24 pages, with speaker notes.
---

The first paragraph is set large, as the post's lede.

## A heading

```sql
SELECT 1;
```
~~~

It's published at `/blog/a-short-slug/` on the next push. Code blocks
labelled `sql`, `rust`, `toml`, `bash`, `json`, `yaml` or `diff` are
highlighted; unlabelled ones are shown as plain output, as in the manuals.

- **Authors.** List each writer once in `src/_data/people.js`, with a name
  and, optionally, their website or blog:
  `jane: { name: "Jane Doe", url: "https://…" }`. Posts name them by key,
  and the byline reads "By Jane Doe and Sam Lee", each linked. A name not
  in the file is shown as written, without a link, and someone can be given
  inline: `authors: [{ name: "…", url: "…" }]`. A post that names nobody
  is by "Turborel contributors". Every author is also credited in the feed.
- **Cover.** Shown under the byline and as a thumbnail in the post lists,
  and used as the share picture. A bare file name is looked up in
  `src/blog/images/`; a path starting with `/` or a full URL also works.
  Make it 1200×630 (other shapes are cropped to that). `coverAlt` says what
  it shows, for screen readers; `coverCaption` adds a caption. The credit
  line reads "Image by Jane Doe via Unsplash · CC BY 4.0"; every part is
  optional, and `coverCreditLabel: Photo by` changes the first words.
- **Attachments.** Listed at the end of the post with their type and size,
  and in the feed. Put them in `src/blog/files/` (a folder per post keeps
  them apart), or give a full URL. They're copied as they are, never turned
  into pages. A file that's missing is left off the post, with a warning in
  the build.
- **Links.** Links in a post (authors, cover credit, attachments, and the
  text) open in a new tab, so following one doesn't lose your place.
  Jumps within the page (`#…`) don't.
- **Sharing.** Every post ends with share buttons: X, LinkedIn, Reddit,
  Hacker News, Bluesky, Facebook and email, plus "Copy link" and, on
  phones, the device's own share sheet. They're plain links (no scripts
  from those sites, nothing tracked); the list is `shareTargets` in
  `lib/icons.js`.

## Social accounts

The footer of every page, the home page's included, shows GitHub and the
project's other accounts as icons. Fill them in under `social` in
`src/_data/site.js` (X, Bluesky, Mastodon, LinkedIn, Reddit, Discord,
YouTube, Threads, Instagram, Facebook); empty ones aren't shown. Icons are
from [Simple Icons](https://simpleicons.org) (CC0), except LinkedIn's,
which isn't in that set.

`src/blog/posts/posts.11tydata.js` lists every front-matter field.

## Working locally

Needs Node 20 or later.

```sh
npm install
npm run dev                         # fetch docs, build, serve at http://localhost:8080
DOCS_LOCAL=../turborel npm run dev  # use your own clone of turborel/turborel instead
npm start                           # serve again without fetching
npm run build                       # what CI runs; output in _site/
```

`fetch-docs` options (environment variables): `DOCS_REPO`, `DOCS_BRANCH`,
`DOCS_LOCAL`, `DOCS_RELEASE_SOURCE=tags` (use git tags instead of GitHub
releases), `DOCS_INCLUDE_PRERELEASES=1`, `DOCS_MAX_VERSIONS` (default 8).
Set `DOCS_STRICT_LINKS=1` to fail the build on a link to a page that
doesn't exist.

## Layout

```
src/home.html                 the home page (published as /index.html), with the
                              latest posts and releases
src/_includes/base.njk        header, related bar, footer: shared by docs and blog
src/docs/page.njk             a docs page: sidebar, version menu, article
src/docs/redirects.njk        /docs/alpha/… → /docs/dev/… once releases exist
src/_data/docs.js             doc/ → pages: URLs, links, contents, versions
src/_data/releases.js         the releases list, for the home page
src/_data/people.js           blog authors: name and website
src/_data/site.js             site name, links, social accounts, home page list lengths
src/_includes/share.njk       share buttons at the end of a post
src/_includes/social-links.njk  footer icons for the project's accounts
lib/icons.js                  icons, share links and the social list
scripts/fetch-docs.js         releases → .cache/docs/<version>/doc and
                              .cache/docs/releases.json
lib/markdown.js               Markdown + build-time highlighting, for docs and blog
src/blog/                     blog index, tags, feed (feed.njk)
src/blog/posts/               the posts; posts.11tydata.js documents front matter
src/blog/images/              cover images
src/blog/files/               attachments (create it with the first one)
src/assets/css/site.css       the design
.github/workflows/deploy.yml  build and publish
```