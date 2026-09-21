import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { OfflineCompiler } from "./offline-compiler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
// The MindAR compiler creates several image pyramids in JavaScript. Limiting
// compiler inputs prevents a large poster photo from exhausting small hosts
// (such as Render's free instance) while retaining enough detail for tracking.
const MAX_COMPILER_IMAGE_DIMENSION = 768;

async function loadCompilerImage(filePath) {
  const image = await loadImage(filePath);
  const largestDimension = Math.max(image.width, image.height);
  if (largestDimension <= MAX_COMPILER_IMAGE_DIMENSION) return image;

  const scale = MAX_COMPILER_IMAGE_DIMENSION / largestDimension;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = createCanvas(width, height);
  canvas.getContext("2d").drawImage(image, 0, 0, width, height);
  console.log(`[compile] Resized ${path.basename(filePath)} to ${width}×${height} for compilation`);
  return canvas;
}

export async function compileMindMulti(imagePaths, outputPath) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  console.log("[compile] Loading", paths.length, "image(s)…");

  const images = [];
  for (const p of paths) {
    const abs = path.resolve(p);
    if (!fs.existsSync(abs)) throw new Error(`Image not found: ${abs}`);
    images.push(await loadCompilerImage(abs));
  }

  console.log("[compile] Compiling .mind (CPU, ~30–90s)…");
  const compiler = new OfflineCompiler();
  await compiler.compileImageTargets(images, (progress) => {
    process.stdout.write(`\r[compile] ${Math.round(progress)}%`);
  });
  process.stdout.write("\n");

  const buffer = compiler.exportData();
  if (!buffer?.byteLength) throw new Error("Compiler produced an empty .mind file");

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.from(buffer));
  console.log("[compile] Done →", outputPath, `(${buffer.byteLength} bytes)`);
  return outputPath;
}

export async function compileMind(imagePath, outputPath) {
  return compileMindMulti([imagePath], outputPath);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const imagePath = process.argv[2] || path.join(ROOT, "assets", "target5.png");
  const outputPath = process.argv[3] || path.join(ROOT, "assets", "targets.mind");
  compileMind(imagePath, outputPath).catch((err) => {
    console.error("[compile] FAILED:", err.message);
    process.exit(1);
  });
}
