import { mkdir, copyFile, readFile, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const destination = fileURLToPath(new URL("../apps/web/public/engines/", import.meta.url));
await mkdir(destination, { recursive: true });
const source = fileURLToPath(new URL("../node_modules/@ffmpeg/core/dist/esm/", import.meta.url));
await copyFile(`${source}/ffmpeg-core.js`, `${destination}/ffmpeg-core.js`);
// Pages accepts at most 25 MiB per file. Both parts stay on the same origin.
const wasm = await readFile(`${source}/ffmpeg-core.wasm`);
const middle = Math.ceil(wasm.length / 2);
await Promise.all([
  writeFile(`${destination}/ffmpeg-core.wasm.0`, wasm.subarray(0, middle)),
  writeFile(`${destination}/ffmpeg-core.wasm.1`, wasm.subarray(middle)),
  rm(`${destination}/ffmpeg-core.wasm`, { force: true }),
]);
