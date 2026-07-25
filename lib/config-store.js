const fs = require("fs");
const path = require("path");
const cloudinary = require("./cloudinary-storage");
const { normalizeConfig } = require("./config-normalize");

const CONFIG_PATH = path.join(__dirname, "..", "data", "config.json");
let cache = null;

function readLocalConfig() {
  return normalizeConfig(JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")));
}

function pickConfig(localConfig, cloudConfig) {
  const localCount = localConfig.targets?.length || 0;
  const cloudCount = cloudConfig?.targets?.length || 0;

  if (localCount > 0 && cloudCount === 0) return localConfig;
  if (cloudCount > 0 && localCount === 0) return cloudConfig;
  if (localCount > 0 && cloudCount > 0) {
    const localTime = Date.parse(localConfig.updatedAt || 0);
    const cloudTime = Date.parse(cloudConfig?.updatedAt || 0);
    return localTime >= cloudTime ? localConfig : cloudConfig;
  }
  if (cloudConfig) return cloudConfig;
  return localConfig;
}

async function readConfig() {
  const localConfig = readLocalConfig();

  if (cache) {
    const cachedCount = cache.targets?.length || 0;
    const localCount = localConfig.targets?.length || 0;
    if (localCount > 0 && cachedCount === 0) {
      cache = null;
    } else {
      return normalizeConfig({ ...cache });
    }
  }

  let cloudConfig = null;

  if (cloudinary.isConfigured()) {
    try {
      const url = cloudinary.getConfigUrl();
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (res.ok) {
        cloudConfig = normalizeConfig(await res.json());
      }
    } catch (err) {
      console.warn("Cloudinary config fetch failed, using local file:", err.message);
    }
  }

  const config = pickConfig(localConfig, cloudConfig);

  if (config.targets?.length > 0) {
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  cache = config;
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

module.exports = { readConfig, writeConfig, clearCache, readLocalConfig };
