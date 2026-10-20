import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionConfig } from "motion/react";
import { getDefaultStore } from "jotai";
import { INITIAL_JOB, DEFAULT_SETTINGS } from "@converta/core";
import { App } from "@/app/App";
import i18n from "@/app/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  entriesAtom,
  busyAtom,
  noticesAtom,
  clearFiles,
  type Entry,
} from "@/features/converter/store";
import { convert } from "@/adapters/convert";
import type { ReactNode } from "react";
// happy-dom has no layout; real VList measurement, scrolling and retention are tested in browsers.
vi.mock("virtua", () => ({
  VList: ({
    data,
    children,
    ssrCount: _ssr,
    keepMounted: _keep,
    ...props
  }: {
    data: Entry[];
    children: (entry: Entry, index: number) => ReactNode;
    ssrCount?: number;
    keepMounted?: number[];
  }) => <div {...props}>{data.map(children)}</div>,
}));
vi.mock("motion/react", async () => {
  const { createElement, forwardRef } = await import("react");
  const tag = (name: string) =>
    forwardRef<HTMLElement, Record<string, unknown>>((props, ref) =>
      createElement(name, {
        ...Object.fromEntries(
          Object.entries(props).filter(
            ([key]) => !["initial", "animate", "exit", "transition", "layout"].includes(key),
          ),
        ),
        ref,
      }),
    );
  return {
    MotionConfig: ({ children }: { children: ReactNode }) => children,
    AnimatePresence: ({ children }: { children: ReactNode }) => children,
    m: { div: tag("div"), section: tag("section"), li: tag("li"), span: tag("span") },
  };
});
vi.mock("@/adapters/convert", () => ({ convert: vi.fn(async () => new Blob(["output"])) }));
vi.mock("@/adapters/inspection", () => ({ inspectFile: vi.fn(async () => null) }));
vi.mock("@/adapters/github", () => ({
  GITHUB_REPOSITORY: "https://github.com/ExtraBinoss/Converta",
  githubStars: vi.fn(async () => 0),
}));
const store = getDefaultStore();
const anchorClick = vi.fn();
function mount() {
  return render(
    <MotionConfig reducedMotion="always">
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </MotionConfig>,
  );
}
const user = userEvent.setup();
beforeEach(async () => {
  store.set(busyAtom, false);
  clearFiles();
  store.set(noticesAtom, []);
  localStorage.clear();
  await i18n.changeLanguage("fr");
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  anchorClick.mockClear();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(anchorClick);
  vi.mocked(convert)
    .mockReset()
    .mockResolvedValue(new Blob(["output"]));
});
describe("converter interface", () => {
  it("imports files through the picker, keyboard, clipboard and drop", async () => {
    mount();
    expect(screen.getByRole("heading", { name: "Converta" })).toBeVisible();
    const input = screen.getByLabelText("Choisir des fichiers");
    const click = vi.spyOn(input as HTMLInputElement, "click");
    await user.click(screen.getByRole("button", { name: "Choisir des fichiers" }));
    expect(click).toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "o", ctrlKey: true });
    expect(click).toHaveBeenCalledTimes(2);
    fireEvent.change(input, {
      target: { files: [new File(["png"], "a.png", { type: "image/png" })] },
    });
    expect(screen.getByText("a.png")).toBeVisible();
    fireEvent.paste(window, { clipboardData: { files: [new File(["wav"], "a.wav")] } });
    expect(screen.getByText("a.wav")).toBeVisible();
    const app = document.querySelector(".app")!;
    fireEvent.dragEnter(app, { dataTransfer: { types: ["text/plain"] } });
    fireEvent.dragEnter(app, { dataTransfer: { types: ["Files"] } });
    expect(screen.getByText("Déposez vos fichiers")).toBeVisible();
    fireEvent.dragOver(app, { dataTransfer: { types: ["Files"], dropEffect: "none" } });
    fireEvent.dragLeave(app);
    fireEvent.drop(app, { dataTransfer: { files: [new File(["webm"], "a.webm")] } });
    expect(screen.getByText("a.webm")).toBeVisible();
    expect(store.get(entriesAtom)).toHaveLength(3);
    expect(screen.queryByRole("tablist")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retirer a.png" }));
    expect(screen.queryByText("a.png")).toBeNull();
    expect(screen.getByText("a.webm")).toBeVisible();
  });
  it("shows import errors with a dismiss action and supports format selection", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Choisir des fichiers"), {
      target: { files: [new File(["pdf"], "a.pdf")] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("pas pris en charge");
    await user.click(screen.getByRole("button", { name: "Fermer" }));
    fireEvent.change(screen.getByLabelText("Choisir des fichiers"), {
      target: { files: [new File(["png"], "a.png")] },
    });
    await user.click(screen.getByRole("combobox", { name: "Format pour a.png" }));
    await user.click(screen.getByRole("option", { name: "JPG" }));
    expect(store.get(entriesAtom)[0]?.format).toBe("jpg");
    await user.click(screen.getByRole("button", { name: "Convertir 1 fichier" }));
    await screen.findByText("1 / 1 terminés");
    await user.click(screen.getByRole("button", { name: "Télécharger a.png" }));
    expect(anchorClick).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Tout télécharger" }));
    await user.click(screen.getByRole("button", { name: "Nouvelle conversion" }));
    expect(screen.getByRole("heading", { name: "Glissez vos fichiers" })).toBeVisible();
  });
  it("exposes compression settings for images, video and audio", async () => {
    mount();
    fireEvent.change(screen.getByLabelText("Choisir des fichiers"), {
      target: {
        files: [
          new File(["jpg"], "a.jpg"),
          new File(["video"], "a.webm"),
          new File(["audio"], "a.wav"),
        ],
      },
    });
    await user.click(screen.getByRole("combobox", { name: "Format pour a.jpg" }));
    await user.click(screen.getByRole("option", { name: "JPG" }));
    await user.click(screen.getByRole("button", { name: "Réglages pour a.jpg" }));
    const quality = screen.getByRole("textbox", { name: "Qualité" });
    await user.clear(quality);
    await user.type(quality, "50{Enter}");
    await user.click(screen.getByRole("combobox", { name: "Côté le plus long" }));
    await user.click(screen.getByRole("option", { name: "800 px" }));
    expect(store.get(entriesAtom)[0]?.settings).toMatchObject({ quality: 50, maxEdge: 800 });
    expect(store.get(entriesAtom)[1]?.settings).toEqual(DEFAULT_SETTINGS);
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Réglages pour a.webm" }));
    const video = screen.getByRole("textbox", { name: "Qualité vidéo" });
    await user.clear(video);
    await user.type(video, "40{Enter}");
    await user.click(screen.getByRole("combobox", { name: "Côté le plus long" }));
    await user.click(screen.getByRole("option", { name: "1280 px" }));
    await user.click(screen.getByRole("combobox", { name: "Images par seconde" }));
    await user.click(screen.getByRole("option", { name: "30 i/s" }));
    await user.click(screen.getByRole("switch", { name: "Retirer le son" }));
    expect(store.get(entriesAtom)[1]?.settings).toMatchObject({
      videoQuality: 40,
      mute: true,
      frameRate: 30,
      videoMaxEdge: 1280,
    });
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Réglages pour a.wav" }));
    await user.click(screen.getByRole("combobox", { name: "Débit audio" }));
    await user.click(screen.getByRole("option", { name: "96 kb/s" }));
    await user.click(screen.getByRole("switch", { name: "Audio mono" }));
    expect(store.get(entriesAtom)[2]?.settings).toMatchObject({ audioBitrate: 96, mono: true });
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }));
    expect(store.get(entriesAtom)[2]?.settings).toEqual(DEFAULT_SETTINGS);
    expect(store.get(entriesAtom)[0]?.settings.quality).toBe(50);
  });
  it("switches theme and language directly from the footer", async () => {
    mount();
    await user.click(screen.getByRole("button", { name: "Sombre" }));
    expect(document.documentElement).toHaveClass("dark");
    await user.click(screen.getByRole("button", { name: "Clair" }));
    expect(document.documentElement).not.toHaveClass("dark");
    await user.click(screen.getByRole("button", { name: "Système" }));
    await user.click(screen.getByRole("combobox", { name: "Langue" }));
    await user.click(screen.getByRole("option", { name: "English" }));
    expect(document.documentElement.lang).toBe("en");
    fireEvent.keyDown(document, { key: "Escape" });
  });
  it("renders mixed queues, retry controls, progress and cancellation", async () => {
    const entries: Entry[] = [
      {
        id: "a",
        file: new File(["a"], "a.gif"),
        kind: "image",
        format: "png",
        job: { ...INITIAL_JOB, status: "done", progress: 1 },
        result: new Blob(["png"]),
        preview: "blob:preview",
        error: null,
        engine: "native",
        settings: { ...DEFAULT_SETTINGS },
        metadata: { width: 64, height: 32, duration: 1 },
      },
      {
        id: "b",
        file: new File(["a"], "b.mkv"),
        kind: "video",
        format: "mp4",
        job: { ...INITIAL_JOB, status: "error" },
        result: null,
        preview: null,
        error: "decode",
        engine: "native",
        settings: { ...DEFAULT_SETTINGS },
        metadata: { width: 64, height: 32, duration: 1 },
      },
      {
        id: "c",
        file: new File(["a"], "c.wav"),
        kind: "audio",
        format: "mp3",
        job: { ...INITIAL_JOB, status: "canceled" },
        result: null,
        preview: null,
        error: null,
        engine: "native",
        settings: { ...DEFAULT_SETTINGS },
        metadata: { width: 64, height: 32, duration: 1 },
      },
    ];
    store.set(entriesAtom, entries);
    mount();
    expect(screen.getByRole("alert")).toHaveTextContent("illisible");
    vi.mocked(convert).mockImplementation(
      (_request, signal, progress, engine) =>
        new Promise((_resolve, reject) => {
          progress(0.4);
          engine("compatibility");
          signal.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    await user.click(screen.getByRole("button", { name: "Réessayer b.mkv" }));
    expect(screen.getByRole("button", { name: "Annuler" })).toBeVisible();
    expect(screen.getByRole("progressbar", { name: "Conversion… b.mkv" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Conversion… b.mkv · 40 %" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("40 %");
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(store.get(busyAtom)).toBe(false));
    const image = document.querySelector(".file-preview img")!;
    fireEvent.error(image);
    expect(image).toHaveStyle({ display: "none" });
    fireEvent.load(image);
    expect(image).not.toHaveStyle({ display: "none" });
    await user.click(screen.getByRole("button", { name: "Tout retirer" }));
    expect(store.get(entriesAtom)).toHaveLength(0);
  });
});
