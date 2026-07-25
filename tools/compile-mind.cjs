const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mind": "application/octet-stream",
};

function createStaticServer() {
  return http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const rel = urlPath === "/" ? "tools/compile-target.html" : urlPath.replace(/^\//, "");
    const filePath = path.join(ROOT, rel);
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  });
}

/**
 * Compile a PNG/JPG target image into a MindAR .mind file.
 * @param {string} imagePath absolute path to source image
 * @param {string} outputPath absolute path for .mind output
 */
async function compileMind(imagePath, outputPath) {
  const relImage = path.relative(ROOT, imagePath).split(path.sep).join("/");
  const imageUrl = "/" + relImage;

  const server = createStaticServer();
  const port = 8700 + Math.floor(Math.random() * 200);

  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", resolve);
    server.on("error", reject);
  });

  try {
    const puppeteer = require("puppeteer");
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--use-gl=angle", "--use-angle=swiftshader"],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout(180000);

    const compileUrl = `http://127.0.0.1:${port}/tools/compile-target.html?image=${encodeURIComponent(imageUrl)}`;
    await page.goto(compileUrl, { waitUntil: "networkidle0" });
    await page.waitForFunction(() => window.__MIND_BUFFER__, { timeout: 180000 });

    const data = await page.evaluate(() => window.__MIND_BUFFER__);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(data));

    await browser.close();
    return outputPath;
  } finally {
    server.close();
  }
}

module.exports = { compileMind };
