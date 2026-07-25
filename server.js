require("dotenv").config();
const fs = require("fs");
const path = require("path");
const os = require("os");
const express = require("express");
const multer = require("multer");
const session = require("express-session");
const { compileMind } = require("./tools/compile-mind.cjs");
const cloudinary = require("./lib/cloudinary-storage");
const configStore = require("./lib/config-store");

const ROOT = __dirname;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const PORT = process.env.PORT || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === "production";

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

app.set("trust proxy", 1);
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "webar-admin-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      secure: IS_PRODUCTION,
      sameSite: "lax",
    },
  })
);

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
      error: "Cloudinary not configured. Set CLOUDINARY_* environment variables on Render.",
    });
  }
  next();
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, cloudinary: cloudinary.isConfigured() });
});

app.get("/api/config", async (_req, res) => {
  try {
    res.json(await configStore.readConfig());
  } catch (err) {
    console.error("Config read error:", err);
    res.status(500).json({ error: "Failed to load config" });
  }
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

app.get("/api/admin/status", async (req, res) => {
  try {
    res.json({
      authenticated: !!req.session?.admin,
      cloudinary: cloudinary.isConfigured(),
      config: await configStore.readConfig(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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

      const config = await configStore.readConfig();
      config.targetImage = imageResult.secure_url;
      config.mindFile = mindResult.secure_url;
      config.planeWidth = planeWidth;
      config.planeHeight = planeHeight;
      await configStore.writeConfig(config);

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

      const config = await configStore.readConfig();
      config.video = result.secure_url;
      await configStore.writeConfig(config);

      res.json({ ok: true, config, message: "Video uploaded to Cloudinary successfully" });
    } catch (err) {
      console.error("Upload video error:", err);
      res.status(500).json({ error: err.message || "Failed to upload video" });
    }
  }
);

app.use(express.static(ROOT));

async function start() {
  try {
    await configStore.readConfig();
    if (cloudinary.isConfigured()) {
      const config = await configStore.readConfig();
      await configStore.writeConfig(config);
      console.log("Config synced to Cloudinary");
    }
  } catch (err) {
    console.warn("Startup config sync warning:", err.message);
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`WebAR server running on port ${PORT}`);
    console.log(`Admin panel: /admin/`);
    if (cloudinary.isConfigured()) {
      console.log(`Cloudinary: connected (cloud: ${process.env.CLOUDINARY_CLOUD_NAME})`);
    } else {
      console.warn("Cloudinary: NOT configured");
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
    throw err;
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
