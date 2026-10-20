import { dimensions, type MediaKind } from "@converta/core";
import { prepareImage } from "./prepare-image";
import { decodeImage } from "./images";

export type MediaInfo = {
  kind: MediaKind;
  width: number | null;
  height: number | null;
  duration: number | null;
  thumbnail: Blob | null;
};
export async function inspectFile(
  file: File,
  kind: MediaKind,
  signal: AbortSignal,
): Promise<MediaInfo | null> {
  signal.throwIfAborted();
  if (kind === "image") {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await decodeImage(await prepareImage(file));
      signal.throwIfAborted();
      const size = dimensions(bitmap.width, bitmap.height, 192);
      const canvas = new OffscreenCanvas(size.width, size.height);
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      return {
        kind,
        width: bitmap.width,
        height: bitmap.height,
        duration: null,
        thumbnail: await canvas.convertToBlob({ type: "image/webp", quality: 0.75 }),
      };
    } catch {
      return null;
    } finally {
      bitmap?.close();
    }
  }
  return new Promise((resolve) => {
    const worker = new Worker(new URL("./inspection.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
      clearTimeout(timeout);
    };
    const abort = () => {
      cleanup();
      resolve(null);
    };
    const timeout = setTimeout(abort, 15000);
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ version: 1; info: MediaInfo | null }>) => {
      if (data.version !== 1) return;
      cleanup();
      resolve(data.info);
    };
    worker.onerror = () => {
      cleanup();
      resolve(null);
    };
    worker.postMessage({ version: 1, file });
  });
}
