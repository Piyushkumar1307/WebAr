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

Manage the target image and video at **http://localhost:3000/admin/**

- Default password: `admin123` (change with `ADMIN_PASSWORD` env variable)
- Upload a new **target image** → compiled and stored on Cloudinary
- Upload a new **video** → stored on Cloudinary (with sound when target is detected)

```bash
ADMIN_PASSWORD=your-secure-password npm start
```

## Project structure

```
WebAR/
├── server.js           # Express server + admin API
├── index.html          # AR scanner (loads config from API)
├── admin/              # Admin panel
├── data/config.json    # Current target + video paths
├── css/style.css
├── js/app.js
└── assets/
    ├── target5.png     # AR target image
    ├── targets.mind    # Compiled tracking file
    └── video.mp4       # AR video
```

## Replace with your own content

### 1. Choose a target image

Use `assets/target5.png` or replace it with your own image (high contrast, lots of detail).

### 2. Compile the `.mind` file

If you change the target image, recompile:

```bash
npm run compile-target
```

Or use the [MindAR Image Compiler](https://hiukim.github.io/mind-ar-js-doc/tools/compile) and save as `assets/targets.mind`.

### 3. Add your video

Place your MP4 file at `assets/video.mp4`.

### 4. Adjust video size on the target

In `index.html`, tweak the `<a-video>` dimensions to match your target aspect ratio:

```html
<a-plane width="1" height="1" ...></a-plane>
```

(`target5.png` is square — use equal width and height.)

## Tips for best tracking

- Good lighting, avoid glare
- Hold the phone steady, ~20–40 cm from the target
- Use images with rich texture (posters, magazine covers, product packaging)
- Test on **HTTPS** or **localhost** — mobile browsers require secure context for camera

## Deploy

Host the folder on any static host (Netlify, Vercel, GitHub Pages). **HTTPS is required** for camera access on mobile.
