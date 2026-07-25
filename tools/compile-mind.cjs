const path = require("path");
const { pathToFileURL } = require("url");

let compileModule;

async function getCompileModule() {
  if (!compileModule) {
    compileModule = await import(pathToFileURL(path.join(__dirname, "compile-node.mjs")).href);
  }
  return compileModule;
}

async function compileMindMulti(imagePaths, outputPath) {
  const mod = await getCompileModule();
  return mod.compileMindMulti(imagePaths, outputPath);
}

async function compileMind(imagePath, outputPath) {
  const mod = await getCompileModule();
  return mod.compileMind(imagePath, outputPath);
}

module.exports = { compileMind, compileMindMulti };
