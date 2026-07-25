const { join } = require("path");

/** @type {import("puppeteer").Configuration} */
module.exports = {
  // Store Chrome inside the project so Render carries it from build → runtime
  cacheDirectory: join(__dirname, ".cache", "puppeteer"),
};
