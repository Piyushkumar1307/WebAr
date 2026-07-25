require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const session = require("express-session");
const cloudinary = require("./lib/cloudinary-storage");
const configStore = require("./lib/config-store");
const targetsService = require("./lib/targets-service");

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

function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: "Unauthorized" });
}

function requireCloudinary(_req, res, next) {
  if (!cloudinary.isConfigured()) {
    return res.status(503).json({
      error: "Cloudinary not configured. Set CLOUDINARY_* environment variables.",
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

app.get("/api/admin/targets", requireAdmin, async (_req, res) => {
  try {
    const config = await configStore.readConfig();
    res.json({ targets: config.targets, mindFile: config.mindFile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post(
  "/api/admin/targets",
  requireAdmin,
  requireCloudinary,
  upload.fields([
    { name: "target", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const targetFile = req.files?.target?.[0];
      const videoFile = req.files?.video?.[0];
      const name = (req.body?.name || "").trim();

      if (!targetFile) return res.status(400).json({ error: "Target image is required" });
      if (!videoFile) return res.status(400).json({ error: "Video is required" });

      const allowedImg = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
      const allowedVid = ["video/mp4", "video/webm", "video/quicktime"];
      if (!allowedImg.includes(targetFile.mimetype)) {
        return res.status(400).json({ error: "Upload a PNG or JPG image" });
      }
      if (!allowedVid.includes(videoFile.mimetype)) {
        return res.status(400).json({ error: "Upload an MP4 or WebM video" });
      }

      let config = await configStore.readConfig();
      config = await targetsService.addTarget(config, {
        name,
        imageBuffer: targetFile.buffer,
        videoBuffer: videoFile.buffer,
      });
      await configStore.writeConfig(config);

      res.json({
        ok: true,
        config,
        message: `"${name || "New target"}" added successfully`,
      });
    } catch (err) {
      console.error("Add target error:", err);
      res.status(500).json({ error: err.message || "Failed to add target" });
    }
  }
);

app.delete("/api/admin/targets/:id", requireAdmin, requireCloudinary, async (req, res) => {
  try {
    let config = await configStore.readConfig();
    const target = config.targets.find((t) => t.id === req.params.id);
    if (!target) return res.status(404).json({ error: "Target not found" });

    config = await targetsService.deleteTarget(config, req.params.id);
    await configStore.writeConfig(config);

    res.json({ ok: true, config, message: `"${target.name}" deleted` });
  } catch (err) {
    console.error("Delete target error:", err);
    res.status(500).json({ error: err.message || "Failed to delete target" });
  }
});

app.use(express.static(ROOT));

async function start() {
  try {
    configStore.clearCache();
    const config = await configStore.readConfig();
    if (cloudinary.isConfigured()) {
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
