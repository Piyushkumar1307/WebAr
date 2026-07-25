const configStore = require("../lib/config-store");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "data", "config.json");

async function syncConfig() {
  configStore.clearCache();
  const local = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));

  if (!local.targets?.length) {
    console.error("No targets in data/config.json — add targets via /admin/ first.");
    process.exit(1);
  }

  const saved = await configStore.writeConfig(local);
  console.log("Synced config to Cloudinary:");
  console.log(`  targets: ${saved.targets.length}`);
  console.log(`  mindFile: ${saved.mindFile || "(empty — re-add targets in admin to compile)"}`);
}

syncConfig().catch((err) => {
  console.error(err);
  process.exit(1);
});
