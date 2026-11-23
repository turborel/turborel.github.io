// The rolling "nightly" pre-release of Turborel (its date, commit and
// downloads), as written by scripts/fetch-docs.js; null when there is none
// (or when fetch-docs hasn't run, or GitHub couldn't be reached).
import fs from "node:fs";
import path from "node:path";

export default function () {
  const file = path.resolve(".cache/docs/nightly.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
