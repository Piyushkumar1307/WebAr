const path = require("path");
const { compileMind } = require("./compile-mind.cjs");

const ROOT = path.join(__dirname, "..");
const imagePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(ROOT, "assets", "target5.png");
const outputPath = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(ROOT, "assets", "targets.mind");

compileMind(imagePath, outputPath)
  .then((out) => console.log("Compiled", out))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
