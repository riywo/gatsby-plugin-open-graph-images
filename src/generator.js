const { Cluster } = require('puppeteer-cluster');
const express = require("express");
const os = require("os");
const fs = require("fs");
const fsPromises = fs.promises;
const http = require("http");
const { join, dirname } = require("path");

exports.generateOgImages = async (imageGenerationJobs) => {
  const servingUrl = await getServingUrl();
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: os.cpus().length,
    puppeteerOptions: {
      args: ['--no-sandbox']
    }
  });
  await cluster.task(async ({ page, data: job }) => {
    const { componentPath, imgPath, size } = job;
    const componentUrl = `${servingUrl}/${componentPath}`;
    await page.setRequestInterception(true);
    page.on('request', LocalRequestOnly(servingUrl));
    await Promise.all([
      page.waitForNavigation({waitUntil: ['load', 'networkidle2']}),
      page.goto(componentUrl),
      page.setViewport(size),
      ensureThatImageDirExists(imgPath)
    ]);
    await page.screenshot({ path: imgPath, clip: { x: 0, y: 0, ...size } });
    await deleteTemporaryFiles(componentPath);
    const printPath = `${imgPath.replace("public", "")} ${size.width}x${size.height}`;
    console.log(`🖼  created Image: ${printPath}`);
  });
  for (const imageGenerationJob of imageGenerationJobs) {
    cluster.queue(imageGenerationJob)
  }
  await cluster.idle();
  await cluster.close();
};

const getServingUrl = async () => {
  const app = express();
  app.use(express.static("public"));
  const server = http.createServer(app);
  await server.listen(0);
  return `http://0.0.0.0:${server.address().port}/`;

};

const LocalRequestOnly = (servingUrl) => (request) => {
  const url = request.url();
  if (url.startsWith(servingUrl) || url.startsWith("data:")) {
    request.continue();
  } else {
    request.abort();
  }
};

const ensureThatImageDirExists = async (path) => {
  const targetDir = dirname(path);

  try {
    await fsPromises.stat(targetDir);
  } catch (err) {
    if (err.code === "ENOENT") {
      await fsPromises.mkdir(targetDir);
    }
  }
};

const deleteTemporaryFiles = async (path) => {
  await fsPromises.unlink(join("public", path, "index.html"));
  await fsPromises.rmdir(join("public", path));
  await fsPromises.unlink(join("public", "page-data", path, "page-data.json"));
  await fsPromises.rmdir(join("public", "page-data", path));
};

