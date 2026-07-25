require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const { compileMind } = require("./compile-mind.cjs");
const cloudinary = require("../lib/cloudinary-storage");

const ROOT = path.join(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "data", "config.json");
const ASSETS_DIR = path.join(ROOT, "assets");

async function migrate() {
  if (!cloudinary.isConfigured()) {
    console.error("Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  if (config.targetImage?.startsWith("http")) {
    console.log("Already using Cloudinary URLs — syncing config file to Cloudinary…");
    const configStore = require("../lib/config-store");
    await configStore.writeConfig(config);
    console.log("Config synced to Cloudinary (webar/config).");
    return;
  }

  console.log("Migrating local assets to Cloudinary…");

  const targetLocal = path.join(ROOT, config.targetImage.replace(/^\//, ""));
  const mindLocal = path.join(ROOT, config.mindFile.replace(/^\//, ""));
  const videoLocal = path.join(ROOT, config.video.replace(/^\//, ""));

  if (fs.existsSync(targetLocal)) {
    const buf = fs.readFileSync(targetLocal);
    const result = await cloudinary.uploadImage(buf, "target");
    config.targetImage = result.secure_url;
    console.log("  target image →", result.secure_url);
  }

  if (fs.existsSync(mindLocal)) {
    const buf = fs.readFileSync(mindLocal);
    const result = await cloudinary.uploadMind(buf, "targets");
    config.mindFile = result.secure_url;
    console.log("  mind file →", result.secure_url);
  }

  if (fs.existsSync(videoLocal)) {
    const buf = fs.readFileSync(videoLocal);
    const result = await cloudinary.uploadVideo(buf, "ar-video");
    config.video = result.secure_url;
    console.log("  video →", result.secure_url);
  }

  config.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log("Done. config.json updated.");

  if (cloudinary.isConfigured()) {
    const configStore = require("../lib/config-store");
    await configStore.writeConfig(config);
    console.log("Config synced to Cloudinary (webar/config).");
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
