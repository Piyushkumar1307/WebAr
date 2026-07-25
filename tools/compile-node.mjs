import fs from "fs";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { loadImage } from "@napi-rs/canvas";
import { OfflineCompiler } from "./offline-compiler.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

export async function compileMindMulti(imagePaths, outputPath) {
  const paths = Array.isArray(imagePaths) ? imagePaths : [imagePaths];
  console.log("[compile] Loading", paths.length, "image(s)…");

  const images = await Promise.all(
    paths.map(async (p) => {
      const abs = path.resolve(p);
      if (!fs.existsSync(abs)) throw new Error(`Image not found: ${abs}`);
      return loadImage(abs);
    })
  );

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
