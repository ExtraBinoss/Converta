import { beforeEach, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS, type FormatId } from "@converta/core";
import { convertCompatibility } from "@/adapters/ffmpeg";
const fake = vi.hoisted(() => ({
  load: vi.fn(),
  writeFile: vi.fn(),
  exec: vi.fn(),
  readFile: vi.fn(),
  terminate: vi.fn(),
  on: vi.fn(),
}));
vi.mock("@ffmpeg/ffmpeg", () => ({
  FFmpeg: class {
    constructor() {
      return fake;
    }
  },
}));
vi.mock("@ffmpeg/ffmpeg/worker?worker&url", () => ({ default: "/worker.js" }));
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer })),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:wasm");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  fake.load.mockResolvedValue(true);
  fake.exec.mockReset().mockResolvedValue(0);
  fake.readFile.mockResolvedValue(new Uint8Array([1, 2]));
  fake.on.mockImplementation(
    (_name: string, handler: ({ progress }: { progress: number }) => void) =>
      handler({ progress: 0.5 }),
  );
});
it("joins same-origin WASM parts in order and releases the object URL after loading failure", async () => {
  const create = vi.spyOn(URL, "createObjectURL");
  const revoke = vi.spyOn(URL, "revokeObjectURL");
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: true,
    arrayBuffer: async () => new Uint8Array([3, 4]).buffer,
  } as Response);
  fake.load.mockRejectedValueOnce(new Error("wasm"));
  const request = {
    version: 1 as const,
    id: "parts",
    file: new File(["x"], "x.avi"),
    kind: "video" as const,
    format: "mp4" as const,
    settings: DEFAULT_SETTINGS,
  };
  await expect(
    convertCompatibility(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("wasm");
  const blob = create.mock.calls[0]![0] as Blob;
  expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([3, 4, 1, 2]);
  expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual([
    "/engines/ffmpeg-core.wasm.0",
    "/engines/ffmpeg-core.wasm.1",
  ]);
  expect(revoke).toHaveBeenCalledWith("blob:wasm");
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  await expect(
    convertCompatibility(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("encode");
});
it.each(["mp4", "mov", "mkv", "webm", "m4a", "mp3", "wav", "flac", "ogg"] as FormatId[])(
  "fallback %s retains required tracks and uses the requested compression",
  async (format) => {
    const progress = vi.fn();
    const blob = await convertCompatibility(
      {
        version: 1,
        id: "a",
        file: new File(["bytes"], "a.webm"),
        kind: "video",
        format,
        settings: { ...DEFAULT_SETTINGS, videoMaxEdge: 800, frameRate: 30, mono: true },
      },
      new AbortController().signal,
      progress,
    );
    expect(blob.size).toBe(2);
    expect(progress).toHaveBeenCalledWith(0.5);
    const args = fake.exec.mock.lastCall![0] as string[];
    expect(args).toContain("-map");
    if (["mp4", "mov", "mkv", "webm"].includes(format)) {
      expect(args).toContain("0:v:0");
      expect(args).toContain("0:a:0?");
      expect(args).toContain("30");
    } else expect(args).toContain("-vn");
    expect(args).toContain("-ac");
  },
);
it("applies mute only to video and releases resources on failure", async () => {
  const request = {
    version: 1 as const,
    id: "x",
    file: new File(["x"], "a.mp4"),
    kind: "video" as const,
    format: "mp4" as const,
    settings: { ...DEFAULT_SETTINGS, mute: true },
  };
  await convertCompatibility(request, new AbortController().signal, vi.fn());
  expect(fake.exec.mock.lastCall![0]).toContain("-an");
  fake.exec.mockResolvedValueOnce(1);
  await expect(
    convertCompatibility(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("track");
  fake.readFile.mockResolvedValueOnce("");
  await expect(
    convertCompatibility(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("empty");
  fake.readFile.mockResolvedValueOnce(new Uint8Array());
  await expect(
    convertCompatibility(request, new AbortController().signal, vi.fn()),
  ).rejects.toThrow("empty");
  const controller = new AbortController();
  controller.abort();
  await expect(convertCompatibility(request, controller.signal, vi.fn())).rejects.toThrow();
  expect(fake.terminate).toHaveBeenCalled();
});
