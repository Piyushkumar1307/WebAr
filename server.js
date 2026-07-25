require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const express = require("express");
const multer = require("multer");
const session = require("express-session");
const { compileMind } = require("./tools/compile-mind.cjs");
const cloudinary = require("./lib/cloudinary-storage");

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, "data", "config.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PORT = process.env.PORT || 3000;

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "webar-admin-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  })
);

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function writeConfig(config) {
  config.updatedAt = new Date().toISOString();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

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
  if (aspect >= 1) {
    return { planeWidth: 1, planeHeight: 1 / aspect };
  }
  return { planeWidth: aspect, planeHeight: 1 };
}

function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

function requireCloudinary(_req, res, next) {
  if (!cloudinary.isConfigured()) {
    return res.status(503).json({
      error: "Cloudinary not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in .env",
    });
  }
  next();
}

app.get("/api/config", (_req, res) => {
  res.json(readConfig());
});

app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.json({ ok: true });
  }
  res.status(401).json({ error: "Invalid password" });
});

app.post("/api/admin/logout", requireAdmin, (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/admin/status", (req, res) => {
  res.json({
    authenticated: !!req.session?.admin,
    cloudinary: cloudinary.isConfigured(),
    config: readConfig(),
  });
});

app.post(
  "/api/admin/upload-target",
  requireAdmin,
  requireCloudinary,
  upload.single("target"),
  async (req, res) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "webar-"));
    try {
      if (!req.file) return res.status(400).json({ error: "No image uploaded" });

      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      if (!allowed.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Upload a PNG or JPG image" });
      }

      const ext = req.file.mimetype === "image/png" ? ".png" : ".jpg";
      const tmpImage = path.join(tmpDir, "target" + ext);
      const tmpMind = path.join(tmpDir, "targets.mind");

      fs.writeFileSync(tmpImage, req.file.buffer);

      const { width, height } = imageDimensions(req.file.buffer);
      const { planeWidth, planeHeight } = planeSize(width, height);

      await compileMind(tmpImage, tmpMind);

      const [imageResult, mindResult] = await Promise.all([
        cloudinary.uploadImage(req.file.buffer, "target"),
        cloudinary.uploadMind(fs.readFileSync(tmpMind), "targets"),
      ]);

      const config = readConfig();
      config.targetImage = imageResult.secure_url;
      config.mindFile = mindResult.secure_url;
      config.planeWidth = planeWidth;
      config.planeHeight = planeHeight;
      writeConfig(config);

      res.json({
        ok: true,
        config,
        message: "Target uploaded to Cloudinary and compiled successfully",
      });
    } catch (err) {
      console.error("Upload target error:", err);
      res.status(500).json({ error: err.message || "Failed to process target image" });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
);

app.post(
  "/api/admin/upload-video",
  requireAdmin,
  requireCloudinary,
  upload.single("video"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No video uploaded" });

      const allowed = ["video/mp4", "video/webm", "video/quicktime"];
      if (!allowed.includes(req.file.mimetype)) {
        return res.status(400).json({ error: "Upload an MP4 or WebM video" });
      }

      const result = await cloudinary.uploadVideo(req.file.buffer, "ar-video");

      const config = readConfig();
      config.video = result.secure_url;
      writeConfig(config);

      res.json({ ok: true, config, message: "Video uploaded to Cloudinary successfully" });
    } catch (err) {
      console.error("Upload video error:", err);
      res.status(500).json({ error: err.message || "Failed to upload video" });
    }
  }
);

app.use(express.static(ROOT));

const server = app.listen(PORT, () => {
  console.log(`WebAR server running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin/`);
  console.log(`Admin password: ${ADMIN_PASSWORD} (set ADMIN_PASSWORD env to change)`);
  if (cloudinary.isConfigured()) {
    console.log(`Cloudinary: connected (cloud: ${process.env.CLOUDINARY_CLOUD_NAME})`);
  } else {
    console.warn("Cloudinary: NOT configured — uploads will fail until .env is set");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use. Either:`);
    console.error(`  1. Stop the other process: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`  2. Use a different port: PORT=3001 npm start\n`);
    process.exit(1);
  }
  throw err;
});
