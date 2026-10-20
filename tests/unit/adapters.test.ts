import { beforeEach, describe, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS, type FormatId } from "@converta/core";
const fake = vi.hoisted(() => ({
  input: { getPrimaryVideoTrack: vi.fn(), getPrimaryAudioTrack: vi.fn(), dispose: vi.fn() },
  init: vi.fn(),
  canEncodeAudio: vi.fn(),
  buffer: new Uint8Array([1, 2]).buffer,
}));
vi.mock("mediabunny", async (original) => {
  const actual = await original<typeof import("mediabunny")>();
  return {
    ...actual,
    Output: class {
      constructor(_options: unknown) {}
    },
    Input: class {
      constructor() {
        return fake.input;
      }
    },
    Conversion: { init: fake.init },
    BufferTarget: class {
      buffer = fake.buffer;
    },
    canEncodeAudio: fake.canEncodeAudio,
  };
});
vi.mock("@mediabunny/aac-encoder", () => ({ registerAacEncoder: vi.fn() }));
vi.mock("@mediabunny/mp3-encoder", () => ({ registerMp3Encoder: vi.fn() }));
vi.mock("@mediabunny/flac-encoder", () => ({ registerFlacEncoder: vi.fn() }));
import { convertMedia } from "@/adapters/media";
beforeEach(() => {
  fake.input.getPrimaryVideoTrack.mockResolvedValue({ displayWidth: 1920, displayHeight: 1080 });
  fake.input.getPrimaryAudioTrack.mockResolvedValue({});
  fake.canEncodeAudio.mockResolvedValue(false);
  fake.buffer = new Uint8Array([1, 2]).buffer;
  fake.init.mockResolvedValue({
    isValid: true,
    discardedTracks: [],
    execute: vi.fn(async () => {}),
  });
  fake.input.dispose.mockClear();
});
describe("Mediabunny adapter", () => {
  it.each(["mp4", "webm", "mov", "mkv", "mp3", "wav", "m4a", "ogg", "flac"] as FormatId[])(
    "produces %s with tracks and resources accounted for",
    async (format) => {
      const result = await convertMedia(
        new File(["media"], "input.webm"),
        format,
        { ...DEFAULT_SETTINGS, videoMaxEdge: 801, frameRate: 30, mono: true },
        vi.fn(),
      );
      expect(result.size).toBe(2);
      expect(fake.input.dispose).toHaveBeenCalledOnce();
      const options = fake.init.mock.calls[0]![0];
      if (["mp3", "wav", "m4a", "ogg", "flac"].includes(format))
        expect(options.video.discard).toBe(true);
      else {
        expect(options.video.width).toBe(800);
        expect(options.video.height % 2).toBe(0);
        expect(options.video.frameRate).toBe(30);
        expect(options.video.forceTranscode).toBe(true);
      }
      expect(options.audio.numberOfChannels).toBe(1);
    },
  );
  it("never silently drops an undecodable audio or video track", async () => {
    fake.init.mockResolvedValue({
      isValid: true,
      discardedTracks: [
        {
          track: { isVideoTrack: () => false, isAudioTrack: () => true },
          reason: "undecodable_source_codec",
        },
      ],
    });
    await expect(
      convertMedia(new File(["a"], "a.mp4"), "mp4", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("track");
    expect(fake.input.dispose).toHaveBeenCalledOnce();
  });
  it("permits explicit mute and user-discarded tracks", async () => {
    fake.canEncodeAudio.mockResolvedValue(true);
    fake.init.mockResolvedValue({
      isValid: true,
      discardedTracks: [{ reason: "discarded_by_user" }],
      execute: vi.fn(async () => {}),
    });
    await convertMedia(
      new File(["a"], "a.mp4"),
      "mp4",
      { ...DEFAULT_SETTINGS, mute: true },
      vi.fn(),
    );
    expect(fake.init.mock.lastCall![0].audio.discard).toBe(true);
  });
  it("rejects empty output, missing audio, invalid conversions and unknown video", async () => {
    fake.input.getPrimaryAudioTrack.mockResolvedValue(null);
    await expect(
      convertMedia(new File(["a"], "a.mp4"), "mp3", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("noAudio");
    fake.input.getPrimaryAudioTrack.mockResolvedValue({});
    fake.init.mockResolvedValue({ isValid: false, discardedTracks: [] });
    await expect(
      convertMedia(new File(["a"], "a.mp4"), "mp4", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("track");
    fake.init.mockResolvedValue({
      isValid: true,
      discardedTracks: [
        {
          track: { isVideoTrack: () => false, isAudioTrack: () => false },
          reason: "unknown_source_codec",
        },
      ],
      execute: vi.fn(async () => {}),
    });
    fake.buffer = new ArrayBuffer(0);
    fake.input.getPrimaryVideoTrack.mockResolvedValue(null);
    await expect(
      convertMedia(new File(["a"], "a.wav"), "wav", DEFAULT_SETTINGS, vi.fn()),
    ).rejects.toThrow("empty");
  });
});
