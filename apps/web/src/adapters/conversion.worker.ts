/// <reference lib="webworker" />
import { ConversionError } from "@converta/core";
import type { ConvertRequest, ConvertResponse } from "./protocol";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage = async ({ data }: MessageEvent<ConvertRequest>) => {
  if (data.version !== 1) return;
  const send = (message: ConvertResponse) => self.postMessage(message);
  const base = { version: 1 as const, id: data.id };
  try {
    const progress = (progress: number) => send({ ...base, type: "progress", progress });
    const convert =
      data.kind === "image"
        ? (await import("./images")).convertImage
        : (await import("./media")).convertMedia;
    const blob = await convert(data.file, data.format, data.settings, progress);
    send({ ...base, type: "done", blob });
  } catch (error) {
    send({
      ...base,
      type: "error",
      code: error instanceof ConversionError ? error.code : "decode",
    });
  }
};
