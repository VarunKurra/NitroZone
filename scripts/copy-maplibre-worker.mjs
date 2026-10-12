#!/usr/bin/env node
/**
 * MapLibre GL v6 loads its Web Worker relative to its own module URL, which breaks once a
 * bundler relocates the module. We serve the (self-contained) worker from /public instead
 * and point MapLibre at it with setWorkerUrl(). Runs automatically after `npm install`.
 */
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs");
const destDir = join(root, "public/vendor");
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "maplibre-gl-worker.mjs"));
const { version } = JSON.parse(readFileSync(join(root, "node_modules/maplibre-gl/package.json"), "utf8"));
console.log(`Copied MapLibre GL ${version} worker to public/vendor/`);
