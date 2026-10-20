import { ConversionError } from "@converta/core";
import type { ConvertRequest, ConvertResponse } from "./protocol";
import { prepareImage } from "./prepare-image";

export async function convert(
  request: ConvertRequest,
  signal: AbortSignal,
  progress: (value: number) => void,
  engine: (name: "native" | "compatibility") => void,
): Promise<Blob> {
  signal.throwIfAborted();
  const file = request.kind === "image" ? await prepareImage(request.file) : request.file;
  signal.throwIfAborted();
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const worker = new Worker(new URL("./conversion.worker.ts", import.meta.url), {
        type: "module",
      });
      const cleanup = () => {
        worker.terminate();
        signal.removeEventListener("abort", abort);
      };
      const abort = () => {
        cleanup();
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.onerror = () => {
        cleanup();
        reject(new ConversionError("encode"));
      };
      worker.onmessage = ({ data }: MessageEvent<ConvertResponse>) => {
        if (data.version !== 1 || data.id !== request.id) return;
        if (data.type === "progress") progress(data.progress);
        else {
          cleanup();
          if (data.type === "done") resolve(data.blob);
          else reject(new ConversionError(data.code as ConversionError["code"]));
        }
      };
      worker.postMessage({ ...request, file });
    });
  } catch (error) {
    if (
      signal.aborted ||
      request.kind === "image" ||
      (error instanceof ConversionError && error.code === "noAudio")
    )
      throw error;
    engine("compatibility");
    progress(0);
    const { convertCompatibility } = await import("./ffmpeg");
    return convertCompatibility(request, signal, progress);
  }
}
