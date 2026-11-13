// Every turborel release, newest first, as written by scripts/fetch-docs.js.
// Empty until the first release (or when fetch-docs hasn't run).
import fs from "node:fs";
import path from "node:path";

export default function () {
  const file = path.resolve(".cache/docs/releases.json");
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
