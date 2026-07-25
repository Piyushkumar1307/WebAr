const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { compileMindMulti } = require("../tools/compile-mind.cjs");
const cloudinary = require("./cloudinary-storage");
const { normalizeConfig } = require("./config-normalize");

function imageDimensions(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  throw new Error("Unsupported image format. Use PNG or JPG.");
}

function planeSize(width, height) {
  const aspect = width / height;
  if (aspect >= 1) return { planeWidth: 1, planeHeight: 1 / aspect };
  return { planeWidth: aspect, planeHeight: 1 };
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  return destPath;
}

async function recompileMind(config) {
  if (config.targets.length === 0) {
    config.mindFile = "";
    return config;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "webar-compile-"));
  try {
    const imagePaths = [];
    for (let i = 0; i < config.targets.length; i++) {
      const ext = config.targets[i].targetImage.includes(".png") ? ".png" : ".jpg";
      const p = path.join(tmpDir, `target-${i}${ext}`);
      await downloadToFile(config.targets[i].targetImage, p);
      imagePaths.push(p);
    }

    const mindPath = path.join(tmpDir, "targets.mind");
    await compileMindMulti(imagePaths, mindPath);

    const mindResult = await cloudinary.uploadMind(fs.readFileSync(mindPath), "targets");
    config.mindFile = mindResult.secure_url;

    config.targets.forEach((t, i) => {
      t.targetIndex = i;
    });

    return config;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function addTarget(config, { name, imageBuffer, videoBuffer }) {
  config = normalizeConfig(config);

  const id = crypto.randomUUID().slice(0, 8);
  const { width, height } = imageDimensions(imageBuffer);
  const { planeWidth, planeHeight } = planeSize(width, height);

  const [imageResult, videoResult] = await Promise.all([
    cloudinary.uploadImage(imageBuffer, id),
    cloudinary.uploadVideo(videoBuffer, id),
  ]);

  config.targets.push({
    id,
    name: name || `Target ${config.targets.length + 1}`,
    targetImage: imageResult.secure_url,
    video: videoResult.secure_url,
    planeWidth,
    planeHeight,
    targetIndex: config.targets.length,
    createdAt: new Date().toISOString(),
  });

  await recompileMind(config);
  return config;
}

async function deleteTarget(config, targetId) {
  config = normalizeConfig(config);
  config.targets = config.targets.filter((t) => t.id !== targetId);
  await recompileMind(config);
  return config;
}

module.exports = { normalizeConfig, addTarget, deleteTarget, recompileMind, imageDimensions, planeSize };
