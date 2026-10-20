/// <reference lib="webworker" />
import { Input, ALL_FORMATS, BlobSource, CanvasSink } from "mediabunny";
import { dimensions } from "@converta/core";
import type { MediaInfo } from "./inspection";
declare const self: DedicatedWorkerGlobalScope;
self.onmessage = async ({ data }: MessageEvent<{ version: 1; file: File }>) => {
  if (data.version !== 1) return;
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(data.file) });
  let info: MediaInfo | null = null;
  try {
    const [video, audio, duration] = await Promise.all([
      input.getPrimaryVideoTrack(),
      input.getPrimaryAudioTrack(),
      input.getDurationFromMetadata(),
    ]);
    if (video) {
      info = {
        kind: "video",
        width: video.displayWidth,
        height: video.displayHeight,
        duration,
        thumbnail: null,
      };
      try {
        const size = dimensions(video.displayWidth, video.displayHeight, 192);
        const sink = new CanvasSink(video, { ...size, fit: "contain", alpha: true, poolSize: 1 });
        const frame = (await sink.getCanvas(0.1)) ?? (await sink.getCanvas(0));
        if (frame)
          info.thumbnail = await (frame.canvas as OffscreenCanvas).convertToBlob({
            type: "image/webp",
            quality: 0.75,
          });
      } catch {
        /* Keep readable metadata when a preview codec is unavailable. */
      }
    } else if (audio)
      info = { kind: "audio", width: null, height: null, duration, thumbnail: null };
  } catch {
    /* Conversion will report unsupported or damaged media explicitly. */
  } finally {
    input.dispose();
  }
  self.postMessage({ version: 1, info });
};
