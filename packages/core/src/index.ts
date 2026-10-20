export type MediaKind = "image" | "video" | "audio";
export { encodeBmp, encodeIco } from "./bitmap";
export type FormatId =
  | "png"
  | "jpg"
  | "webp"
  | "avif"
  | "gif"
  | "bmp"
  | "ico"
  | "tiff"
  | "mp4"
  | "webm"
  | "mov"
  | "mkv"
  | "mp3"
  | "wav"
  | "m4a"
  | "ogg"
  | "flac";
export type Format = {
  id: FormatId;
  label: string;
  kind: MediaKind;
  mime: string;
  lossless: boolean;
};
export const FORMATS: readonly Format[] = [
  { id: "png", label: "PNG", kind: "image", mime: "image/png", lossless: true },
  { id: "jpg", label: "JPG", kind: "image", mime: "image/jpeg", lossless: false },
  { id: "webp", label: "WebP", kind: "image", mime: "image/webp", lossless: false },
  { id: "avif", label: "AVIF", kind: "image", mime: "image/avif", lossless: false },
  { id: "gif", label: "GIF", kind: "image", mime: "image/gif", lossless: false },
  { id: "bmp", label: "BMP", kind: "image", mime: "image/bmp", lossless: true },
  { id: "ico", label: "ICO", kind: "image", mime: "image/x-icon", lossless: true },
  { id: "tiff", label: "TIFF", kind: "image", mime: "image/tiff", lossless: true },
  { id: "mp4", label: "MP4", kind: "video", mime: "video/mp4", lossless: false },
  { id: "webm", label: "WebM", kind: "video", mime: "video/webm", lossless: false },
  { id: "mov", label: "MOV", kind: "video", mime: "video/quicktime", lossless: false },
  { id: "mkv", label: "MKV", kind: "video", mime: "video/x-matroska", lossless: false },
  { id: "mp3", label: "MP3", kind: "audio", mime: "audio/mpeg", lossless: false },
  { id: "wav", label: "WAV", kind: "audio", mime: "audio/wav", lossless: true },
  { id: "m4a", label: "M4A", kind: "audio", mime: "audio/mp4", lossless: false },
  { id: "ogg", label: "OGG", kind: "audio", mime: "audio/ogg", lossless: false },
  { id: "flac", label: "FLAC", kind: "audio", mime: "audio/flac", lossless: true },
];
const imageExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "bmp",
  "ico",
  "tif",
  "tiff",
  "svg",
  "heic",
  "heif",
  "jxl",
]);
const videoExtensions = new Set([
  "mp4",
  "m4v",
  "webm",
  "mov",
  "mkv",
  "avi",
  "ts",
  "mts",
  "m2ts",
  "3gp",
]);
const audioExtensions = new Set([
  "mp3",
  "wav",
  "wave",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "opus",
  "flac",
  "aiff",
  "aif",
]);
export function extension(name: string): string {
  return name.includes(".") ? name.split(".").at(-1)!.toLowerCase() : "";
}
export function detectKind(name: string, mime: string): MediaKind | null {
  const ext = extension(name);
  if (imageExtensions.has(ext) || mime.startsWith("image/")) return "image";
  if (videoExtensions.has(ext) || mime.startsWith("video/")) return "video";
  if (audioExtensions.has(ext) || mime.startsWith("audio/")) return "audio";
  return null;
}
export function getFormat(id: FormatId): Format {
  return FORMATS.find((format) => format.id === id)!;
}
export function outputFormats(kind: MediaKind): readonly Format[] {
  return FORMATS.filter(
    (format) => format.kind === kind || (kind === "video" && format.kind === "audio"),
  );
}
export function defaultFormat(kind: MediaKind): FormatId {
  return kind === "image" ? "png" : kind === "video" ? "mp4" : "mp3";
}
export function outputName(name: string, format: FormatId): string {
  return `${name.replace(/\.[^.]+$/, "") || "fichier"}.${format}`;
}
export function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>();
  return names.map((name) => {
    let candidate = name;
    let index = 2;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const suffix = dot > 0 ? name.slice(dot) : "";
    while (used.has(candidate.toLowerCase())) candidate = `${stem} (${index++})${suffix}`;
    used.add(candidate.toLowerCase());
    return candidate;
  });
}
export function dimensions(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (![width, height, maxEdge].every(Number.isFinite) || width <= 0 || height <= 0 || maxEdge < 0)
    throw new Error("dimensions");
  const ratio = maxEdge === 0 ? 1 : Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}
export type Settings = {
  quality: number;
  maxEdge: number;
  mute: boolean;
  videoQuality: number;
  videoMaxEdge: number;
  frameRate: number;
  audioBitrate: number;
  mono: boolean;
};
export const DEFAULT_SETTINGS: Settings = {
  quality: 85,
  maxEdge: 0,
  mute: false,
  videoQuality: 75,
  videoMaxEdge: 0,
  frameRate: 0,
  audioBitrate: 192,
  mono: false,
};
export type JobStatus = "ready" | "converting" | "done" | "error" | "canceled";
export type JobState = { status: JobStatus; progress: number; runId: string | null };
export type JobEvent =
  | { type: "start"; runId: string }
  | { type: "progress"; runId: string; progress: number }
  | { type: "done" | "error" | "cancel"; runId: string }
  | { type: "reset" };
export const INITIAL_JOB: JobState = { status: "ready", progress: 0, runId: null };
export function transition(state: JobState, event: JobEvent): JobState {
  if (event.type === "reset") return state.status === "converting" ? state : INITIAL_JOB;
  if (event.type === "start")
    return state.status === "converting"
      ? state
      : { status: "converting", progress: 0, runId: event.runId };
  if (state.status !== "converting" || state.runId !== event.runId) return state;
  if (event.type === "progress")
    return Number.isFinite(event.progress)
      ? {
          ...state,
          progress: Math.max(state.progress, Math.min(0.99, Math.max(0, event.progress))),
        }
      : state;
  return {
    ...state,
    status: event.type === "cancel" ? "canceled" : event.type,
    progress: event.type === "done" ? 1 : state.progress,
  };
}
export class ConversionError extends Error {
  constructor(
    public readonly code:
      | "unsupported"
      | "decode"
      | "encode"
      | "tooLarge"
      | "empty"
      | "noAudio"
      | "track"
      | "svg"
      | "dimensions",
  ) {
    super(code);
    this.name = "ConversionError";
  }
}
