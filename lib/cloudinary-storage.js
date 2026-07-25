require("dotenv").config();
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;

const FOLDER = process.env.CLOUDINARY_FOLDER || "webar";

function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

function configure() {
  if (!isConfigured()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env"
    );
  }
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function uploadBuffer(buffer, options = {}) {
  configure();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

async function uploadImage(buffer, name = "target") {
  return uploadBuffer(buffer, {
    folder: `${FOLDER}/targets`,
    public_id: name,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });
}

async function uploadVideo(buffer, name = "ar-video") {
  return uploadBuffer(buffer, {
    folder: `${FOLDER}/videos`,
    public_id: name,
    resource_type: "video",
    overwrite: true,
    invalidate: true,
  });
}

async function uploadMind(buffer, name = "targets") {
  return uploadBuffer(buffer, {
    folder: `${FOLDER}/mind`,
    public_id: name,
    resource_type: "raw",
    overwrite: true,
    invalidate: true,
  });
}

async function uploadConfig(jsonString) {
  return uploadBuffer(Buffer.from(jsonString, "utf8"), {
    folder: FOLDER,
    public_id: "config",
    resource_type: "raw",
    overwrite: true,
    invalidate: true,
  });
}

function getConfigUrl() {
  if (!isConfigured()) return null;
  configure();
  return cloudinary.url(`${FOLDER}/config`, { resource_type: "raw", secure: true });
}

module.exports = {
  isConfigured,
  configure,
  uploadImage,
  uploadVideo,
  uploadMind,
  uploadConfig,
  getConfigUrl,
};
