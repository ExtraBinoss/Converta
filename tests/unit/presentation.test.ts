import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { observeScrollShadows } from "@/adapters/presentation/scroll-shadows";
import { observeMarquee } from "@/adapters/presentation/marquee";

const { animate, stop } = vi.hoisted(() => ({ animate: vi.fn(), stop: vi.fn() }));
vi.mock("motion/mini", () => ({ animate }));
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
let resizeCallbacks: (() => void)[];
let mutationCallbacks: ((records: Partial<MutationRecord>[]) => void)[];
let reduced: EventTarget & { matches: boolean };
let hidden: boolean;
const disposers: (() => void)[] = [];
function flush() {
  const callbacks = [...frames.values()];
  frames.clear();
  callbacks.forEach((callback) => callback(0));
}
beforeEach(() => {
  frames = new Map();
  nextFrame = 0;
  resizeCallbacks = [];
  mutationCallbacks = [];
  hidden = false;
  reduced = Object.assign(new EventTarget(), { matches: false });
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.stubGlobal("matchMedia", () => reduced);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: (records: Partial<MutationRecord>[]) => void) {
        mutationCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  animate.mockClear();
  stop.mockClear();
  animate.mockImplementation((element: HTMLElement) => {
    element.style.transform = "translate3d(-10px, 0, 0)";
    return { cancel: stop };
  });
});
afterEach(() => {
  disposers.splice(0).forEach((dispose) => dispose());
  vi.unstubAllGlobals();
});

describe("scroll edges", () => {
  it("tracks real hidden content at both ends, coalesces scroll events and responds to resizing", () => {
    const surface = document.createElement("div"),
      viewport = document.createElement("div");
    viewport.append(document.createElement("div"));
    let height = 100,
      content = 500;
    Object.defineProperties(viewport, {
      clientHeight: { get: () => height },
      scrollHeight: { get: () => content },
    });
    const dispose = observeScrollShadows(viewport, surface);
    disposers.push(dispose);
    expect(surface.dataset).toMatchObject({ scrollTop: "false", scrollBottom: "true" });
    viewport.scrollTop = 200;
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("scroll"));
    expect(frames.size).toBe(1);
    flush();
    expect(surface.dataset).toMatchObject({ scrollTop: "true", scrollBottom: "true" });
    viewport.scrollTop = 399.5;
    window.dispatchEvent(new Event("resize"));
    flush();
    expect(surface.dataset.scrollBottom).toBe("false");
    content = height = 500;
    viewport.scrollTop = 0;
    resizeCallbacks[0]!();
    flush();
    expect(surface.dataset).toMatchObject({ scrollTop: "false", scrollBottom: "false" });
    content = 800;
    mutationCallbacks[0]!([{ target: viewport }]);
    flush();
    expect(surface.dataset.scrollBottom).toBe("true");
    mutationCallbacks[0]!([{ target: viewport.firstChild! }]);
    flush();
    expect(surface.dataset.scrollBottom).toBe("true");
    viewport.scrollTop = 500;
    viewport.dispatchEvent(new Event("scroll"));
    const pending = [...frames.values()][0]!;
    dispose();
    expect(frames.size).toBe(0);
    pending(0);
    resizeCallbacks[0]!();
    viewport.dispatchEvent(new Event("scroll"));
    expect(frames.size).toBe(0);
    expect(surface.dataset.scrollTop).toBe("false");
  });
});

function label(insideButton = false) {
  const viewport = document.createElement("span"),
    text = document.createElement("span");
  viewport.append(text);
  if (insideButton) document.createElement("button").append(viewport);
  let width = 100,
    content = 400;
  Object.defineProperty(viewport, "clientWidth", { get: () => width });
  Object.defineProperty(text, "scrollWidth", { get: () => content });
  const dispose = observeMarquee(viewport, text);
  disposers.push(dispose);
  return {
    viewport,
    text,
    dispose,
    size: (w: number, c: number) => {
      width = w;
      content = c;
    },
  };
}
function enter(viewport: HTMLElement, pointerType = "mouse") {
  viewport.dispatchEvent(new PointerEvent("pointerenter", { pointerType }));
}
describe("overflow marquee", () => {
  it("animates only an overflowing hovered name with a transform and stops immediately on leave", () => {
    const { viewport, text } = label();
    expect(viewport.dataset.overflow).toBe("true");
    expect(viewport.tabIndex).toBe(0);
    expect(animate).not.toHaveBeenCalled();
    enter(viewport);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate.mock.calls[0]?.[1].transform[1]).toBe("translate3d(-300px, 0px, 0px)");
    expect(viewport.dataset.marqueeActive).toBe("true");
    viewport.dispatchEvent(new PointerEvent("pointerleave"));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(viewport.dataset.marqueeActive).toBeUndefined();
    expect(text.style.transform).toBe("");
    enter(viewport);
    viewport.dispatchEvent(new PointerEvent("pointercancel"));
    expect(text.style.transform).toBe("");
  });
  it("ignores touch and fitting labels and remeasures changed text and geometry", () => {
    const { viewport, size } = label();
    enter(viewport, "touch");
    expect(animate).not.toHaveBeenCalled();
    size(400, 100);
    mutationCallbacks[0]!([]);
    resizeCallbacks[0]!();
    flush();
    expect(viewport.tabIndex).toBe(-1);
    enter(viewport);
    expect(animate).not.toHaveBeenCalled();
    size(100, 104);
    resizeCallbacks[0]!();
    flush();
    expect(viewport.dataset.marqueeActive).toBe("true");
    expect(animate.mock.calls[0]?.[2].duration).toBeCloseTo(3);
  });
  it("supports focus, does not add a nested tab stop in a button, and respects reduced motion", () => {
    const { viewport } = label(true);
    const button = viewport.parentElement!;
    expect(viewport.hasAttribute("tabindex")).toBe(false);
    button.dispatchEvent(new FocusEvent("focus"));
    expect(viewport.dataset.marqueeActive).toBe("true");
    reduced.matches = true;
    reduced.dispatchEvent(new Event("change"));
    expect(viewport.dataset.marqueeActive).toBeUndefined();
    reduced.matches = false;
    reduced.dispatchEvent(new Event("change"));
    expect(viewport.dataset.marqueeActive).toBe("true");
    button.dispatchEvent(new FocusEvent("blur"));
    expect(viewport.dataset.marqueeActive).toBeUndefined();
    enter(viewport);
    button.dispatchEvent(new FocusEvent("blur"));
    expect(viewport.dataset.marqueeActive).toBe("true");
  });
  it("pauses in a hidden document and releases animation, observers and pending frames on disposal", () => {
    const { viewport, text, dispose } = label();
    viewport.dispatchEvent(new FocusEvent("focus"));
    hidden = true;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(text.style.transform).toBe("");
    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));
    expect(viewport.dataset.marqueeActive).toBe("true");
    resizeCallbacks[0]!();
    const pending = [...frames.values()][0]!;
    dispose();
    pending(0);
    resizeCallbacks[0]!();
    enter(viewport);
    expect(frames.size).toBe(0);
    expect(text.style.transform).toBe("");
    expect(viewport.dataset.marqueeActive).toBeUndefined();
  });
});
