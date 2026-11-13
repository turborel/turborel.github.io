// Small inline SVG icons for share buttons and social links. Brand marks
// come from Simple Icons (CC0, https://simpleicons.org); LinkedIn isn't in
// that set, so it gets a plain "in", and the generic ones are drawn here.
import { siX, siFacebook, siReddit, siYcombinator, siBluesky, siMastodon, siGithub, siYoutube, siDiscord, siThreads, siInstagram } from "simple-icons";

const brand = {
  x: siX, facebook: siFacebook, reddit: siReddit, hackernews: siYcombinator, bluesky: siBluesky,
  mastodon: siMastodon, github: siGithub, youtube: siYoutube, discord: siDiscord, threads: siThreads,
  instagram: siInstagram,
};

const drawn = {
  linkedin: '<path d="M4.5 9h3.2v10.5H4.5zM6.1 3.8a1.85 1.85 0 1 1 0 3.7 1.85 1.85 0 0 1 0-3.7zM9.9 9h3.06v1.44h.05c.43-.8 1.47-1.65 3.03-1.65 3.24 0 3.84 2.13 3.84 4.9v5.81h-3.2v-5.15c0-1.23-.02-2.81-1.71-2.81-1.71 0-1.97 1.34-1.97 2.72v5.24H9.9z"/>',
  email: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M3 5.5h18v13H3z M3.5 6l8.5 7 8.5-7"/>',
  link: '<path fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  share: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v8h14v-8"/>',
  check: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.5l5 5 10-11"/>',
};

export function icon(name, size = 18) {
  const inner = brand[name] ? `<path d="${brand[name].path}"/>` : drawn[name];
  if (!inner) return "";
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`;
}

// Where to share a page, newest-habit first. All plain links: no scripts
// from these sites, nothing loaded until a reader clicks.
export function shareTargets(url, title, description) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  return [
    { key: "x", label: "X", href: `https://x.com/intent/tweet?url=${u}&text=${t}` },
    { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { key: "reddit", label: "Reddit", href: `https://www.reddit.com/submit?url=${u}&title=${t}` },
    { key: "hackernews", label: "Hacker News", href: `https://news.ycombinator.com/submitlink?u=${u}&t=${t}` },
    { key: "bluesky", label: "Bluesky", href: `https://bsky.app/intent/compose?text=${encodeURIComponent(`${title} ${url}`)}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    {
      key: "email", label: "Email",
      href: `mailto:?subject=${t}&body=${encodeURIComponent((description ? description + "\n\n" : "") + url)}`,
    },
  ];
}

// The project's own accounts, for the footer: GitHub, then whichever of
// site.social are filled in, in this order.
const SOCIAL = [
  ["github", "GitHub"], ["x", "X"], ["bluesky", "Bluesky"], ["mastodon", "Mastodon"],
  ["linkedin", "LinkedIn"], ["reddit", "Reddit"], ["discord", "Discord"], ["youtube", "YouTube"],
  ["threads", "Threads"], ["instagram", "Instagram"], ["facebook", "Facebook"],
];
export function socialLinks(site) {
  const urls = { github: site.github, ...(site.social || {}) };
  return SOCIAL.filter(([k]) => urls[k]).map(([key, label]) => ({ key, label, url: urls[key] }));
}
