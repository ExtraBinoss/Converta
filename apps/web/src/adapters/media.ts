import {
  Input,
  ALL_FORMATS,
  BlobSource,
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  MovOutputFormat,
  MkvOutputFormat,
  Mp3OutputFormat,
  WavOutputFormat,
  OggOutputFormat,
  FlacOutputFormat,
  Conversion,
  Quality,
  canEncodeAudio,
  type VideoCodec,
  type AudioCodec,
} from "mediabunny";
import {
  ConversionError,
  dimensions,
  getFormat,
  type FormatId,
  type Settings,
} from "@converta/core";

export async function convertMedia(
  file: File,
  format: FormatId,
  settings: Settings,
  progress: (value: number) => void,
): Promise<Blob> {
  const targetFormat = getFormat(format);
  const audioOnly = targetFormat.kind === "audio";
  if (
    (format === "mp4" || format === "mov" || format === "m4a") &&
    !(await canEncodeAudio("aac"))
  ) {
    const { registerAacEncoder } = await import("@mediabunny/aac-encoder");
    registerAacEncoder();
  }
  if (format === "mp3") {
    const { registerMp3Encoder } = await import("@mediabunny/mp3-encoder");
    registerMp3Encoder();
  }
  if (format === "flac") {
    const { registerFlacEncoder } = await import("@mediabunny/flac-encoder");
    registerFlacEncoder();
  }
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const video = await input.getPrimaryVideoTrack();
    const audio = await input.getPrimaryAudioTrack();
    if (audioOnly && !audio) throw new ConversionError("noAudio");
    const outputFormat =
      format === "webm"
        ? new WebMOutputFormat()
        : format === "mov"
          ? new MovOutputFormat()
          : format === "mkv"
            ? new MkvOutputFormat()
            : format === "mp3"
              ? new Mp3OutputFormat()
              : format === "wav"
                ? new WavOutputFormat()
                : format === "ogg"
                  ? new OggOutputFormat()
                  : format === "flac"
                    ? new FlacOutputFormat()
                    : new Mp4OutputFormat({ fastStart: "in-memory" });
    const target = new BufferTarget();
    const output = new Output({ format: outputFormat, target });
    const videoCodec: VideoCodec = format === "webm" ? "vp9" : "avc";
    const audioCodec: AudioCodec =
      format === "mp3"
        ? "mp3"
        : format === "wav"
          ? "pcm-s16"
          : format === "flac"
            ? "flac"
            : format === "webm" || format === "ogg"
              ? "opus"
              : "aac";
    const size =
      video && settings.videoMaxEdge
        ? dimensions(video.displayWidth, video.displayHeight, settings.videoMaxEdge)
        : null;
    const conversion = await Conversion.init({
      input,
      output,
      showWarnings: false,
      video: audioOnly
        ? { discard: true }
        : {
            codec: videoCodec,
            forceTranscode: true,
            quality: new Quality({ quality: settings.videoQuality / 100 }),
            ...(settings.frameRate ? { frameRate: settings.frameRate } : {}),
            ...(size
              ? {
                  width: Math.max(2, size.width - (size.width % 2)),
                  height: Math.max(2, size.height - (size.height % 2)),
                }
              : {}),
          },
      audio: {
        discard: !audioOnly && settings.mute,
        codec: audioCodec,
        forceTranscode: true,
        quality: new Quality({ bitrate: settings.audioBitrate * 1000 }),
        ...(settings.mono ? { numberOfChannels: 1 } : {}),
      },
      tags: {},
    });
    const lostTrack = conversion.discardedTracks.some(
      ({ track, reason }) =>
        reason !== "discarded_by_user" && (track.isVideoTrack() || track.isAudioTrack()),
    );
    if (!conversion.isValid || lostTrack) throw new ConversionError("track");
    conversion.onProgress = progress;
    await conversion.execute();
    if (!target.buffer?.byteLength) throw new ConversionError("empty");
    return new Blob([target.buffer], { type: targetFormat.mime });
  } finally {
    input.dispose();
  }
}
