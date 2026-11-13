export default {
  name: "turborel",
  url: "https://turborel.com",
  description:
    "turborel is an open-source, extensible relational database system written in Rust.",
  repo: "turborel/turborel",
  github: "https://github.com/turborel/turborel",
  newsletter: "https://forms.gle/YNJ5YGpBTFW9vvTj8",
  // The project's accounts, shown as icons in every page's footer next to
  // GitHub. Leave "" to hide one.
  social: {
    x: "https://x.com/turborel",
    bluesky: "", // https://bsky.app/profile/…
    mastodon: "", // https://…/@… (linked with rel="me", for verification)
    linkedin: "https://www.linkedin.com/company/turborel",
    reddit: "https://www.reddit.com/r/turborel",
    discord: "", // https://discord.gg/…
    youtube: "https://www.youtube.com/@turborel",
    threads: "",
    instagram: "",
    facebook: "https://www.facebook.com/turborel",
  },
  // The bar across the top of the home page. Readers can close it; give a
  // new notice a new id and it shows again, even to those who closed the
  // last one. text: "" hides it.
  notice: {
    id: "in-alpha",
    text: "Alpha in progress ⭐ Star the repo to stay in the loop.",
  },
  analytics: "G-XDW3XF90B8", // Google Analytics, as on the home page; "" to drop it
  author: "Turborel contributors",
  homePosts: 3, // newest blog posts listed on the home page
  homeReleases: 5, // newest releases listed on the home page
  year: new Date().getFullYear(),
};
