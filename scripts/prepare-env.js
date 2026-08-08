/**
 * Bakes the local .env into the desktop app before packaging.
 *
 * The generated file is git-ignored on purpose: the token lives inside the
 * built .exe, never inside the repository.
 */
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const ROOT = path.resolve(__dirname, "..");
const SOURCE = path.join(ROOT, ".env");
const TARGET = path.join(ROOT, "desktop", "embedded-env.json");
const REQUIRED = ["DISCORD_TOKEN", "CLIENT_ID"];

// `--clear` produces a build with no secrets inside, safe to hand to someone
// else. That build reads a .env placed next to the .exe instead.
if (process.argv.includes("--clear")) {
  if (fs.existsSync(TARGET)) {
    fs.unlinkSync(TARGET);
    console.log("[prepare-env] Removed embedded credentials — build will be shareable.");
  } else {
    console.log("[prepare-env] No embedded credentials present — build will be shareable.");
  }
  process.exit(0);
}

if (!fs.existsSync(SOURCE)) {
  console.error(`[prepare-env] Missing ${SOURCE}. Copy .env.example to .env and fill it in first.`);
  process.exit(1);
}

const parsed = dotenv.parse(fs.readFileSync(SOURCE));
const missing = REQUIRED.filter((key) => !parsed[key]);

if (missing.length > 0) {
  console.error(`[prepare-env] .env is missing required keys: ${missing.join(", ")}`);
  process.exit(1);
}

fs.writeFileSync(TARGET, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
console.log(`[prepare-env] Embedded ${Object.keys(parsed).length} variables into ${TARGET}`);
