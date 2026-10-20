import { beforeEach, it, expect, vi } from "vitest";
import { DEFAULT_SETTINGS, ConversionError } from "@converta/core";
import { convert } from "@/adapters/convert";
import type { ConvertRequest, ConvertResponse } from "@/adapters/protocol";
import { convertCompatibility } from "@/adapters/ffmpeg";
import { prepareImage } from "@/adapters/prepare-image";
vi.mock("@/adapters/prepare-image", () => ({ prepareImage: vi.fn(async (file: File) => file) }));
vi.mock("@/adapters/ffmpeg", () => ({
  convertCompatibility: vi.fn(async () => new Blob(["fallback"])),
}));

const terminate = vi.fn();
class FakeWorker {
  onmessage: ((event: { data: ConvertResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  static latest: FakeWorker;
  constructor() {
    FakeWorker.latest = this;
  }
  terminate = terminate;
  postMessage = vi.fn();
}
const request: ConvertRequest = {
  version: 1,
  id: "a",
  file: new File(["image"], "a.png"),
  kind: "image",
  format: "png",
  settings: DEFAULT_SETTINGS,
};
beforeEach(() => {
  vi.stubGlobal("Worker", FakeWorker);
  terminate.mockClear();
  vi.mocked(convertCompatibility).mockClear();
});
it("matches worker messages to requests and releases worker resources", async () => {
  const progress = vi.fn();
  const result = convert(request, new AbortController().signal, progress, vi.fn());
  await vi.waitFor(() => expect(FakeWorker.latest.postMessage).toHaveBeenCalled());
  FakeWorker.latest.onmessage!({
    data: { version: 1, id: "stale", type: "done", blob: new Blob(["bad"]) },
  });
  FakeWorker.latest.onmessage!({ data: { version: 1, id: "a", type: "progress", progress: 0.5 } });
  FakeWorker.latest.onmessage!({
    data: { version: 1, id: "a", type: "done", blob: new Blob(["valid"]) },
  });
  expect(await (await result).text()).toBe("valid");
  expect(progress).toHaveBeenCalledWith(0.5);
  expect(terminate).toHaveBeenCalledOnce();
});
it("cancels an active worker and supports cancellation before import", async () => {
  const controller = new AbortController();
  const result = convert(request, controller.signal, vi.fn(), vi.fn());
  const failed = expect(result).rejects.toThrow("Aborted");
  await vi.waitFor(() => expect(FakeWorker.latest.postMessage).toHaveBeenCalled());
  controller.abort();
  await failed;
  expect(terminate).toHaveBeenCalled();
  await expect(convert(request, controller.signal, vi.fn(), vi.fn())).rejects.toThrow();
  const during = new AbortController();
  vi.mocked(prepareImage).mockImplementationOnce(async (file) => {
    during.abort();
    return file;
  });
  await expect(convert(request, during.signal, vi.fn(), vi.fn())).rejects.toThrow();
});
it("reports image decoding and worker crashes without pretending to succeed", async () => {
  let result = convert(request, new AbortController().signal, vi.fn(), vi.fn());
  let failure = expect(result).rejects.toThrow("decode");
  await vi.waitFor(() => expect(FakeWorker.latest.postMessage).toHaveBeenCalled());
  FakeWorker.latest.onmessage!({ data: { version: 1, id: "a", type: "error", code: "decode" } });
  await failure;
  result = convert(request, new AbortController().signal, vi.fn(), vi.fn());
  failure = expect(result).rejects.toThrow("encode");
  await vi.waitFor(() => expect(FakeWorker.latest.postMessage).toHaveBeenCalled());
  FakeWorker.latest.onerror!();
  await failure;
});
it("falls back for media codecs but keeps missing audio errors explicit", async () => {
  const video = { ...request, kind: "video" as const, format: "mp4" as const };
  const engine = vi.fn();
  let result = convert(video, new AbortController().signal, vi.fn(), engine);
  await vi.waitFor(() => expect(FakeWorker.latest.postMessage).toHaveBeenCalled());
  FakeWorker.latest.onerror!();
  expect(await (await result).text()).toBe("fallback");
  expect(engine).toHaveBeenCalledWith("compatibility");
  result = convert(video, new AbortController().signal, vi.fn(), engine);
  const failure = expect(result).rejects.toBeInstanceOf(ConversionError);
  await vi.waitFor(() => expect(FakeWorker.latest.postMessage).toHaveBeenCalled());
  FakeWorker.latest.onmessage!({ data: { version: 1, id: "a", type: "error", code: "noAudio" } });
  await failure;
});
