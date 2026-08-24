import { copyFile, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dashboardRoot = fileURLToPath(new URL("..", import.meta.url));
const targetDirectory = resolve(dashboardRoot, "public/vendor/nsfwjs");

const tensorflowDist = dirname(require.resolve("@tensorflow/tfjs"));
const nsfwPackageRoot = resolve(dirname(require.resolve("nsfwjs")), "../..");
const modelDirectory = resolve(nsfwPackageRoot, "dist/models/mobilenet_v2");

const assets = [
  [resolve(tensorflowDist, "tf.min.js"), "tf.min.js"],
  [resolve(nsfwPackageRoot, "dist/browser/nsfwjs.min.js"), "nsfwjs.min.js"],
  [resolve(modelDirectory, "model.min.js"), "model.min.js"],
  [
    resolve(modelDirectory, "group1-shard1of1.min.js"),
    "group1-shard1of1.min.js",
  ],
];

await rm(targetDirectory, { recursive: true, force: true });
await mkdir(targetDirectory, { recursive: true });
await Promise.all(
  assets.map(([source, filename]) =>
    copyFile(source, resolve(targetDirectory, filename)),
  ),
);
