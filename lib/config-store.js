const fs = require("fs");
const path = require("path");
const cloudinary = require("./cloudinary-storage");

const CONFIG_PATH = path.join(__dirname, "..", "data", "config.json");
let cache = null;

function readLocalConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

async function readConfig() {
  if (cache) return { ...cache };

  if (cloudinary.isConfigured()) {
    try {
      const url = cloudinary.getConfigUrl();
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (res.ok) {
        cache = await res.json();
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
  config.updatedAt = new Date().toISOString();
  cache = { ...config };

  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  if (cloudinary.isConfigured()) {
    await cloudinary.uploadConfig(JSON.stringify(config, null, 2));
  }

  return cache;
}

function clearCache() {
  cache = null;
}

module.exports = { readConfig, writeConfig, clearCache };
