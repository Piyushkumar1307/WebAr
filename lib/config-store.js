const fs = require("fs");
const path = require("path");
const cloudinary = require("./cloudinary-storage");
const { normalizeConfig } = require("./config-normalize");

const CONFIG_PATH = path.join(__dirname, "..", "data", "config.json");
let cache = null;

function readLocalConfig() {
  return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
}

async function readConfig() {
  if (cache) return normalizeConfig({ ...cache });

  if (cloudinary.isConfigured()) {
    try {
      const url = cloudinary.getConfigUrl();
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (res.ok) {
        cache = normalizeConfig(await res.json());
        return { ...cache };
      }
    } catch (err) {
      console.warn("Cloudinary config fetch failed, using local file:", err.message);
    }
  }

  cache = readLocalConfig();
  return { ...cache };
}

async function writeConfig(config) {
  const normalized = normalizeConfig(config);
  normalized.updatedAt = new Date().toISOString();
  cache = normalized;

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(normalized, null, 2));

  if (cloudinary.isConfigured()) {
    await cloudinary.uploadConfig(JSON.stringify(normalized, null, 2));
  }

  return cache;
}

function clearCache() {
  cache = null;
}

module.exports = { readConfig, writeConfig, clearCache };
