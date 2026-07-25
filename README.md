# WebAR — Image Target Video Player

Scan a printed or on-screen **target image** with your phone camera. When the image is detected, a video plays on top of it in augmented reality.

Built with [MindAR](https://github.com/hiukim/mind-ar-js) + [A-Frame](https://aframe.io/).

## Quick start

1. **Start the server** (required — camera and admin won't work from `file://`):

   ```bash
   npm install
   npm start
   ```

2. Open **http://localhost:3000** on your phone (same Wi‑Fi), e.g. `http://192.168.x.x:3000`

3. Tap **Start Scanner**, then point the camera at the target image

## Cloudinary storage

Uploads are stored on **Cloudinary**, not on the server. Copy `.env.example` to `.env` and fill in:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name   # top-left of Cloudinary dashboard
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Migrate existing local assets to Cloudinary once:

```bash
npm run migrate-cloudinary
```

## Admin panel

The admin panel lets you manage **multiple AR targets** — each with its own image and video — without replacing existing ones.

**URL:** `http://localhost:3000/admin/` (or `https://your-domain.com/admin/` in production)

### Sign in

Default password: `admin123`

Set a secure password via environment variable:

```bash
ADMIN_PASSWORD=your-secure-password npm start
```

Also set `SESSION_SECRET` in production (e.g. `openssl rand -hex 32`).

### Layout

| Area | Description |
|------|-------------|
| **Sidebar** | Lists all targets with thumbnail, name, and date |
| **Add panel** | Upload a new target image + AR video together |
| **Detail panel** | Preview a target's image/video and delete it |

On **mobile**, tap the ☰ menu to open the sidebar as a slide-out drawer. On **desktop** (≥900px), the sidebar stays visible.

### Add a new target

1. Sign in to the admin panel
2. Tap **+ Add target** in the sidebar
3. Enter an optional **name** (e.g. "AYZEN Poster")
4. Choose a **target image** (PNG, JPG, or WebP — high contrast works best)
5. Choose an **AR video** (MP4, WebM, or MOV)
6. Tap **Add target & video**

The server uploads both files to Cloudinary, compiles a combined `.mind` tracking file for all targets, and updates the scanner automatically. Compilation may take ~30 seconds.

### View or delete a target

1. Tap any target in the sidebar
2. Preview its image and video in the detail panel
3. Tap **Delete** to remove it (remaining targets are recompiled)

### How it works

- Each target gets a unique ID and a `targetIndex` in the shared MindAR file
- When the scanner detects a target, it plays **that target's video** with sound
- Adding or deleting a target recompiles the `.mind` file — no manual steps needed
- Config is stored in `data/config.json` locally and synced to Cloudinary on Render

### Config format

```json
{
  "mindFile": "https://res.cloudinary.com/.../webar/mind/targets",
  "targets": [
    {
      "id": "abc12345",
      "name": "AYZEN Poster",
      "targetImage": "https://res.cloudinary.com/.../webar/targets/abc12345",
      "video": "https://res.cloudinary.com/.../webar/videos/abc12345",
      "planeWidth": 1,
      "planeHeight": 1,
      "targetIndex": 0,
      "createdAt": "2026-07-25T04:10:27.715Z"
    }
  ],
  "updatedAt": "2026-07-25T04:10:27.715Z"
}
```

### Admin API

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/admin/login` | Sign in (`{ "password": "..." }`) |
| `POST` | `/api/admin/logout` | Sign out |
| `GET` | `/api/admin/status` | Auth status + full config |
| `GET` | `/api/admin/targets` | List targets |
| `POST` | `/api/admin/targets` | Add target (multipart: `name`, `target`, `video`) |
| `DELETE` | `/api/admin/targets/:id` | Delete target by ID |

Public scanner config: `GET /api/config`

## Project structure

```
WebAR/
├── server.js              # Express server + admin API
├── index.html             # AR scanner (loads config from API)
├── admin/
│   ├── index.html         # Admin panel UI
│   ├── admin.css          # Sidebar + mobile layout
│   └── admin.js           # Target list, add, delete
├── lib/
│   ├── config-store.js    # Read/write config (local + Cloudinary)
│   ├── targets-service.js # Add/delete targets, recompile .mind
│   └── cloudinary-storage.js
├── data/config.json       # targets[] + mindFile (synced to Cloudinary)
├── css/style.css
├── js/app.js              # Multi-target AR scanner
└── assets/                # Local fallback assets
```

## Replace with your own content

The easiest way is through the **admin panel** — upload a target image and video there. The server handles Cloudinary upload and `.mind` compilation automatically.

For manual/local development without the admin panel:

### 1. Choose a target image

Use a high-contrast image with rich detail (posters, logos, packaging).

### 2. Compile the `.mind` file

```bash
npm run compile-target
```

Or use the [MindAR Image Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile) and save as `assets/targets.mind`.

### 3. Add your video

Place your MP4 at `assets/video.mp4`, then run `npm run migrate-cloudinary` to push assets to Cloudinary.

Video plane size is calculated automatically from the target image aspect ratio when using the admin panel.

## Tips for best tracking

- Good lighting, avoid glare
- Hold the phone steady, ~20–40 cm from the target
- Use images with rich texture (posters, magazine covers, product packaging)
- Test on **HTTPS** or **localhost** — mobile browsers require secure context for camera

## Deploy

This app requires a **Node.js server** (Express) — it is not a static-only site. Deploy to [Render](https://render.com), Railway, Fly.io, or any Node host.

**HTTPS is required** for camera access on mobile.

### Environment variables (production)

```bash
NODE_ENV=production
ADMIN_PASSWORD=your-secure-password
SESSION_SECRET=your-random-secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=webar
PUPPETEER_CACHE_DIR=/opt/render/project/src/.cache/puppeteer
```

Adding targets in the admin panel compiles a `.mind` file via **Puppeteer + Chrome**. On Render:

1. Use the included `render.yaml` (build installs Chrome automatically), **or** set your build command to:
   ```bash
   npm install && npx puppeteer browsers install chrome
   ```
2. Set `PUPPETEER_CACHE_DIR` as above so Chrome is stored inside the project and available at runtime.
3. After updating Puppeteer settings, do **Manual Deploy → Clear build cache & deploy** once so Chrome is reinstalled.

If uploads fail with “Could not find Chrome”, clear the build cache and redeploy.

After deploy:
- Scanner: `https://your-app.onrender.com/`
- Admin: `https://your-app.onrender.com/admin/`

A `render.yaml` is included for one-click Render deployment.
