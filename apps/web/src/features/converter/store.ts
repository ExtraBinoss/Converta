import { atom, getDefaultStore } from "jotai";
import {
  DEFAULT_SETTINGS,
  INITIAL_JOB,
  ConversionError,
  defaultFormat,
  detectKind,
  outputName,
  uniqueNames,
  outputFormats,
  transition,
  type FormatId,
  type JobState,
  type MediaKind,
  type Settings,
} from "@converta/core";
import { convert } from "@/adapters/convert";
import { inspectFile } from "@/adapters/inspection";
export type Entry = {
  id: string;
  file: File;
  kind: MediaKind;
  format: FormatId;
  job: JobState;
  result: Blob | null;
  preview: string | null;
  error: string | null;
  engine: "native" | "compatibility";
  settings: Settings;
  metadata: { width: number | null; height: number | null; duration: number | null } | null;
};
export const entriesAtom = atom<Entry[]>([]);
export const busyAtom = atom(false);
export const noticesAtom = atom<{ id: string; name: string; code: string }[]>([]);
const store = getDefaultStore();
let active: AbortController | null = null;
type Inspection = { controller: AbortController; promise: Promise<void>; resolve: () => void };
const inspections = new Map<string, Inspection>();
const inspectionQueue: string[] = [];
let inspecting = 0;
function enqueueInspection(id: string): void {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  inspections.set(id, { controller: new AbortController(), promise, resolve });
  inspectionQueue.push(id);
}
function inspectNext(): void {
  if (inspecting >= 2) return;
  const id = inspectionQueue.shift();
  if (!id) return;
  const entry = store.get(entriesAtom).find((value) => value.id === id);
  const pending = inspections.get(id);
  if (!entry || !pending) {
    inspectNext();
    return;
  }
  inspecting++;
  void inspectFile(entry.file, entry.kind, pending.controller.signal)
    .then((info) => {
      if (!info || pending.controller.signal.aborted) return;
      edit(id, (value) => {
        const preview = info.thumbnail ? URL.createObjectURL(info.thumbnail) : value.preview;
        if (preview !== value.preview) release(value);
        const format = outputFormats(info.kind).some((format) => format.id === value.format)
          ? value.format
          : defaultFormat(info.kind);
        return {
          ...value,
          kind: info.kind,
          format,
          preview,
          metadata: { width: info.width, height: info.height, duration: info.duration },
        };
      });
    })
    .catch(() => {
      /* Preview failure must not prevent conversion. */
    })
    .finally(() => {
      inspections.delete(id);
      pending.resolve();
      inspecting--;
      inspectNext();
    });
  inspectNext();
}
function stopInspection(id: string): void {
  const pending = inspections.get(id);
  if (!pending) return;
  pending.controller.abort();
  pending.resolve();
  inspections.delete(id);
  const index = inspectionQueue.indexOf(id);
  if (index >= 0) inspectionQueue.splice(index, 1);
}
function edit(id: string, update: (entry: Entry) => Entry): void {
  store.set(entriesAtom, (entries) =>
    entries.map((entry) => (entry.id === id ? update(entry) : entry)),
  );
}
function release(entry: Entry): void {
  if (entry.preview) URL.revokeObjectURL(entry.preview);
}
export function addFiles(files: readonly File[]): void {
  const entries = [...store.get(entriesAtom)];
  const notices: { id: string; name: string; code: string }[] = [];
  const added: string[] = [];
  for (const file of files) {
    const kind = detectKind(file.name, file.type);
    const code = !kind
      ? "unsupported"
      : file.size === 0
        ? "empty"
        : file.size > 1_000_000_000 || (kind === "image" && file.size > 100_000_000)
          ? "tooLarge"
          : entries.length >= 40
            ? "limit"
            : null;
    if (code || !kind) {
      notices.push({ id: crypto.randomUUID(), name: file.name, code: code ?? "unsupported" });
      continue;
    }
    const id = crypto.randomUUID();
    added.push(id);
    entries.push({
      id,
      file,
      kind,
      format: defaultFormat(kind),
      job: INITIAL_JOB,
      result: null,
      preview:
        kind === "image" && !/\.(svg|heic|heif|tiff?)$/i.test(file.name)
          ? URL.createObjectURL(file)
          : null,
      error: null,
      engine: "native",
      settings: { ...DEFAULT_SETTINGS },
      metadata: null,
    });
  }
  store.set(entriesAtom, entries);
  store.set(noticesAtom, notices);
  added.forEach(enqueueInspection);
  inspectNext();
}
export function removeFile(id: string): void {
  if (store.get(busyAtom)) return;
  store.set(entriesAtom, (entries) =>
    entries.filter((entry) => {
      if (entry.id !== id) return true;
      stopInspection(id);
      release(entry);
      return false;
    }),
  );
}
export function clearFiles(): void {
  if (store.get(busyAtom)) return;
  [...inspections.keys()].forEach(stopInspection);
  store.get(entriesAtom).forEach(release);
  store.set(entriesAtom, []);
}
export function setFormat(id: string, format: FormatId): void {
  if (store.get(busyAtom)) return;
  edit(id, (entry) => ({ ...entry, format, job: INITIAL_JOB, result: null, error: null }));
}
export function setSettings(id: string, settings: Settings): void {
  if (store.get(busyAtom)) return;
  edit(id, (entry) =>
    JSON.stringify(entry.settings) === JSON.stringify(settings)
      ? entry
      : { ...entry, settings, job: INITIAL_JOB, result: null, error: null },
  );
}
export function cancel(): void {
  active?.abort();
}
export async function start(ids?: readonly string[]): Promise<void> {
  if (store.get(busyAtom)) return;
  const selected = ids ? new Set(ids) : null;
  const pending = store
    .get(entriesAtom)
    .filter((entry) => entry.job.status !== "done" && (!selected || selected.has(entry.id)));
  if (!pending.length) return;
  store.set(busyAtom, true);
  active = new AbortController();
  const controller = active;
  try {
    for (const queued of pending) {
      if (controller.signal.aborted) break;
      const inspection = inspections.get(queued.id);
      if (inspection && queued.kind !== "image")
        await Promise.race([
          inspection.promise,
          new Promise<void>((resolve) =>
            controller.signal.addEventListener("abort", () => resolve(), { once: true }),
          ),
        ]);
      if (controller.signal.aborted) break;
      const entry = store.get(entriesAtom).find((value) => value.id === queued.id);
      if (!entry) continue;
      const runId = crypto.randomUUID();
      edit(entry.id, (value) => ({
        ...value,
        error: null,
        engine: "native",
        job: transition(value.job, { type: "start", runId }),
      }));
      let lastProgress = 0;
      try {
        const blob = await convert(
          {
            version: 1,
            id: runId,
            file: entry.file,
            kind: entry.kind,
            format: entry.format,
            settings: { ...entry.settings },
          },
          controller.signal,
          (progress) => {
            const now = performance.now();
            if (now - lastProgress < 90 && progress < 0.99) return;
            lastProgress = now;
            edit(entry.id, (value) => ({
              ...value,
              job: transition(value.job, { type: "progress", runId, progress }),
            }));
          },
          (engine) => edit(entry.id, (value) => ({ ...value, engine })),
        );
        controller.signal.throwIfAborted();
        edit(entry.id, (value) => ({
          ...value,
          result: blob,
          job: transition(value.job, { type: "done", runId }),
        }));
      } catch (error) {
        const aborted = controller.signal.aborted;
        edit(entry.id, (value) => ({
          ...value,
          result: null,
          error: aborted ? null : error instanceof ConversionError ? error.code : "unknown",
          job: transition(value.job, { type: aborted ? "cancel" : "error", runId }),
        }));
      }
    }
  } finally {
    active = null;
    store.set(busyAtom, false);
  }
}
export function download(entry: Entry): void {
  if (entry.result) save(entry.result, outputName(entry.file.name, entry.format));
}
function save(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type DownloadMode = "individual" | "zip";
export async function downloadAll(mode: DownloadMode = "zip"): Promise<void> {
  const done = store.get(entriesAtom).filter((entry) => entry.result);
  if (!done.length) return;
  const names = uniqueNames(done.map((entry) => outputName(entry.file.name, entry.format)));
  if (mode === "individual") {
    // Start all downloads in the original user gesture, without timers or network requests.
    done.forEach((entry, index) => save(entry.result!, names[index]!));
    return;
  }
  const { zip } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  await Promise.all(
    done.map(async (entry, index) => {
      files[names[index]!] = new Uint8Array(await entry.result!.arrayBuffer());
    }),
  );
  const result = await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) =>
    zip(files, { level: 0 }, (error, data) =>
      error ? reject(error) : resolve(new Uint8Array(data)),
    ),
  );
  save(new Blob([result], { type: "application/zip" }), "converta.zip");
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    cancel();
    [...inspections.keys()].forEach(stopInspection);
    store.get(entriesAtom).forEach(release);
  });
