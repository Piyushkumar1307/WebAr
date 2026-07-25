const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

function getCacheDir() {
  const cacheDir =
    process.env.PUPPETEER_CACHE_DIR || path.join(ROOT, ".cache", "puppeteer");
  process.env.PUPPETEER_CACHE_DIR = cacheDir;
  return cacheDir;
}

async function ensureChrome() {
  const cacheDir = getCacheDir();
  fs.mkdirSync(cacheDir, { recursive: true });

  const {
    Browser,
    computeExecutablePath,
    detectBrowserPlatform,
    getInstalledBrowsers,
    install,
    resolveBuildId,
  } = require("@puppeteer/browsers");
  const { PUPPETEER_REVISIONS } = require("puppeteer-core/internal/revisions.js");

  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error("Unsupported platform for Puppeteer");
  }

  const buildId = await resolveBuildId(
    Browser.CHROME,
    platform,
    PUPPETEER_REVISIONS.chrome
  );

  const exe = computeExecutablePath({
    browser: Browser.CHROME,
    cacheDir,
    buildId,
  });

  if (fs.existsSync(exe)) {
    return exe;
  }

  console.log("[puppeteer] Installing Chrome to", cacheDir);

  await install({
    browser: Browser.CHROME,
    cacheDir,
    platform,
    buildId,
    downloadProgressCallback: (downloaded, total) => {
      if (!total) return;
      const pct = Math.round((downloaded / total) * 100);
      process.stdout.write(`\r[puppeteer] Downloading Chrome… ${pct}%`);
    },
  });

  process.stdout.write("\n");

  if (fs.existsSync(exe)) {
    console.log("[puppeteer] Chrome ready at", exe);
    return exe;
  }

  const installed = await getInstalledBrowsers({ cacheDir });
  throw new Error(
    `Chrome install finished but executable was not found at ${exe}. ` +
      `Installed browsers: ${JSON.stringify(installed)}`
  );
}

if (require.main === module) {
  ensureChrome()
    .then((exe) => {
      console.log("[puppeteer] OK:", exe);
    })
    .catch((err) => {
      console.error("[puppeteer] FAILED:", err.message);
      process.exit(1);
    });
}

module.exports = { ensureChrome, getCacheDir };
