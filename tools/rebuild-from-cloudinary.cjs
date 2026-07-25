require("dotenv").config();
const cloudinary = require("../lib/cloudinary-storage");
const configStore = require("../lib/config-store");
const { recompileMind } = require("../lib/targets-service");

const FOLDER = process.env.CLOUDINARY_FOLDER || "webar";

async function listResources(resourceType, prefix) {
  cloudinary.configure();
  const api = require("cloudinary").v2.api;
  const out = [];
  let nextCursor;

  do {
    const page = await api.resources({
      type: "upload",
      resource_type: resourceType,
      prefix,
      max_results: 100,
      next_cursor: nextCursor,
    });
    out.push(...(page.resources || []));
    nextCursor = page.next_cursor;
  } while (nextCursor);

  return out;
}

async function rebuild() {
  if (!cloudinary.isConfigured()) {
    console.error("Cloudinary not configured.");
    process.exit(1);
  }

  console.log("Scanning Cloudinary for uploaded targets…");
  const [images, videos] = await Promise.all([
    listResources("image", `${FOLDER}/targets/`),
    listResources("video", `${FOLDER}/videos/`),
  ]);

  const videoById = new Map(
    videos.map((v) => [v.public_id.replace(`${FOLDER}/videos/`, ""), v.secure_url])
  );

  const targets = images
    .map((img) => {
      const id = img.public_id.replace(`${FOLDER}/targets/`, "");
      const video = videoById.get(id);
      if (!video) return null;
      return {
        id,
        name: `Target ${id}`,
        targetImage: img.secure_url,
        video,
        planeWidth: 1,
        planeHeight: 1,
        targetIndex: 0,
        createdAt: img.created_at || new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (!targets.length) {
    console.error("No matching target image + video pairs found in Cloudinary.");
    console.error("Upload a target via /admin/ first.");
    process.exit(1);
  }

  console.log(`Found ${targets.length} target pair(s). Compiling .mind…`);
  let config = { mindFile: "", targets, updatedAt: new Date().toISOString() };
  config = await recompileMind(config);
  await configStore.writeConfig(config);

  console.log("Config rebuilt and saved:");
  console.log(`  targets: ${config.targets.length}`);
  console.log(`  mindFile: ${config.mindFile}`);
}

rebuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
