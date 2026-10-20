import { FFmpeg } from "@ffmpeg/ffmpeg";
import { ConversionError, getFormat } from "@converta/core";
import type { ConvertRequest } from "./protocol";

export async function convertCompatibility(
  request: ConvertRequest,
  signal: AbortSignal,
  progress: (value: number) => void,
): Promise<Blob> {
  const ffmpeg = new FFmpeg();
  let wasmURL: string | undefined;
  const abort = () => ffmpeg.terminate();
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    const { default: classWorkerURL } = await import("@ffmpeg/ffmpeg/worker?worker&url");
    const chunks = await Promise.all(
      [0, 1].map(async (part) => {
        const response = await fetch(`/engines/ffmpeg-core.wasm.${part}`, { signal });
        if (!response.ok) throw new ConversionError("encode");
        return response.arrayBuffer();
      }),
    );
    signal.throwIfAborted();
    wasmURL = URL.createObjectURL(new Blob(chunks, { type: "application/wasm" }));
    await ffmpeg.load({
      coreURL: new URL("/engines/ffmpeg-core.js", location.origin).href,
      wasmURL,
      classWorkerURL,
    });
    signal.throwIfAborted();
    ffmpeg.on("progress", ({ progress: value }) => progress(Math.max(0, Math.min(0.99, value))));
    await ffmpeg.writeFile("input", new Uint8Array(await request.file.arrayBuffer()));
    const { format, settings } = request;
    const isAudio = getFormat(format).kind === "audio";
    const args = ["-i", "input", "-map_metadata", "-1"];
    if (isAudio) args.push("-vn", "-map", "0:a:0");
    else args.push("-map", "0:v:0", "-map", "0:a:0?");
    if (!isAudio && settings.mute) args.push("-an");
    if (!isAudio) {
      args.push(
        "-c:v",
        format === "webm" ? "libvpx-vp9" : "libx264",
        "-crf",
        String(Math.round(40 - settings.videoQuality * 0.24)),
      );
      if (format !== "webm") args.push("-preset", "veryfast", "-pix_fmt", "yuv420p");
      if (settings.frameRate) args.push("-r", String(settings.frameRate));
      const edge = settings.videoMaxEdge;
      args.push(
        "-vf",
        edge
          ? `scale=w='min(${edge},iw)':h='min(${edge},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`
          : "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      );
    }
    if (!settings.mute || isAudio) {
      const codec =
        format === "mp3"
          ? "libmp3lame"
          : format === "wav"
            ? "pcm_s16le"
            : format === "flac"
              ? "flac"
              : format === "webm" || format === "ogg"
                ? "libopus"
                : "aac";
      args.push("-c:a", codec);
      if (format !== "wav" && format !== "flac") args.push("-b:a", `${settings.audioBitrate}k`);
      if (settings.mono) args.push("-ac", "1");
    }
    if (format === "mp4" || format === "m4a" || format === "mov")
      args.push("-movflags", "+faststart");
    args.push("-y", `output.${format}`);
    const exit = await ffmpeg.exec(args);
    signal.throwIfAborted();
    if (exit !== 0) throw new ConversionError("track");
    const result = await ffmpeg.readFile(`output.${format}`);
    if (typeof result === "string" || !result.length) throw new ConversionError("empty");
    return new Blob([new Uint8Array(result)], { type: getFormat(format).mime });
  } finally {
    signal.removeEventListener("abort", abort);
    ffmpeg.terminate();
    if (wasmURL) URL.revokeObjectURL(wasmURL);
  }
}
