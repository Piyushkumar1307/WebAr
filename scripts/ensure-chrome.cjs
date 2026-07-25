const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const cacheDir =
  process.env.PUPPETEER_CACHE_DIR || path.join(ROOT, ".cache", "puppeteer");

function getExecutablePath() {
  try {
    const puppeteer = require("puppeteer");
    return puppeteer.executablePath();
  } catch {
    return null;
  }
}

function ensureChrome() {
  const exe = getExecutablePath();
  if (exe && fs.existsSync(exe)) {
    return exe;
  }

  console.log("[puppeteer] Chrome not found — installing to", cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });

  execSync("npx puppeteer browsers install chrome", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir },
  });

  const installed = getExecutablePath();
  if (!installed || !fs.existsSync(installed)) {
    throw new Error(
      "Chrome install finished but executable was not found. " +
        "On Render: redeploy with “Clear build cache”, and ensure buildCommand runs " +
        "`npx puppeteer browsers install chrome`."
    );
  }

  console.log("[puppeteer] Chrome ready at", installed);
  return installed;
}

if (require.main === module) {
  ensureChrome();
}

module.exports = { ensureChrome, cacheDir };
