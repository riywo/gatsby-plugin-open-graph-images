const puppeteer = require("puppeteer");
const express = require("express");
const fs = require("fs");
const http = require("http");
const { join, dirname } = require("path");

exports.generateOgImages = async (imageGenerationJobs) => {
  const servingUrl = await getServingUrl();
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  for (const imageGenerationJob of imageGenerationJobs) {
    const { componentPath, imgPath, size } = imageGenerationJob;
    const componentUrl = `${servingUrl}/${componentPath}`;

    await Promise.all([
      page.waitForNavigation({waitUntil: ['load', 'networkidle2']}),
      page.goto(componentUrl),
      page.setViewport(size),
    ]);

    ensureThatImageDirExists(imgPath);
    await page.screenshot({ path: imgPath, clip: { x: 0, y: 0, ...size } });

    fs.unlinkSync(join("public", componentPath, "index.html"));
    fs.rmdirSync(join("public", componentPath));
    fs.unlinkSync(join("public", "page-data", componentPath, "page-data.json"));
    fs.rmdirSync(join("public", "page-data", componentPath));

    const printPath = `${imgPath.replace("public", "")} ${size.width}x${size.height}`;
    console.log(`🖼  created Image: ${printPath}`);
  }

  await browser.close();
};

const getServingUrl = async () => {
  const app = express();
  app.use(express.static("public"));
  const server = http.createServer(app);
  await server.listen(0);
  return `http://0.0.0.0:${server.address().port}/`;

};

const ensureThatImageDirExists = (path) => {
  const targetDir = dirname(path);

  try {
    fs.statSync(targetDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      fs.mkdirSync(targetDir);
    }
  }
};
