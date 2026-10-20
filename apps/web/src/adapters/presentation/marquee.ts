import { animate } from "motion/mini";
/** Only the active, overflowing label gets an animation/compositing layer. */
export function observeMarquee(viewport: HTMLElement, text: HTMLElement): () => void {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const focusTarget = viewport.closest<HTMLElement>("button, a, [role=option]") ?? viewport;
  let controls: ReturnType<typeof animate> | null = null;
  let frame = 0,
    disposed = false,
    hovered = false,
    focused = false,
    distance = 0;
  const stop = () => {
    controls?.cancel();
    controls = null;
    delete viewport.dataset.marqueeActive;
    text.style.removeProperty("transform");
  };
  const play = () => {
    stop();
    if (disposed || document.hidden || reduced.matches || (!hovered && !focused) || distance <= 1)
      return;
    viewport.dataset.marqueeActive = "true";
    const travel = Math.max(0.8, distance / 40),
      duration = travel * 2 + 1.4;
    const origin = "translate3d(0px, 0px, 0px)",
      end = `translate3d(${-distance}px, 0px, 0px)`;
    controls = animate(
      text,
      { transform: [origin, end, end, origin, origin] },
      {
        duration,
        delay: 0.35,
        times: [0, travel / duration, (travel + 0.7) / duration, (travel * 2 + 0.7) / duration, 1],
        ease: "linear",
        repeat: Infinity,
      },
    );
  };
  const measure = () => {
    frame = 0;
    if (disposed) return;
    const next = Math.max(0, text.scrollWidth - viewport.clientWidth);
    const changed = Math.abs(next - distance) > 1;
    distance = next;
    viewport.dataset.overflow = String(distance > 1);
    if (focusTarget === viewport) viewport.tabIndex = distance > 1 ? 0 : -1;
    if (changed) play();
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(measure);
  };
  const enter = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    hovered = true;
    measure();
    if (!controls) play();
  };
  const leave = () => {
    hovered = false;
    focused = false;
    stop();
  };
  const focus = () => {
    focused = true;
    measure();
    if (!controls) play();
  };
  const blur = () => {
    focused = false;
    if (!hovered) stop();
  };
  const visibility = () => {
    if (document.hidden) stop();
    else play();
  };
  const resize = new ResizeObserver(schedule);
  resize.observe(viewport);
  const mutation = new MutationObserver(schedule);
  mutation.observe(text, { childList: true, subtree: true, characterData: true });
  viewport.addEventListener("pointerenter", enter);
  viewport.addEventListener("pointerleave", leave);
  viewport.addEventListener("pointercancel", leave);
  focusTarget.addEventListener("focus", focus);
  focusTarget.addEventListener("blur", blur);
  reduced.addEventListener("change", play);
  document.addEventListener("visibilitychange", visibility);
  document.fonts?.addEventListener("loadingdone", schedule);
  void document.fonts?.ready.then(schedule);
  measure();
  return () => {
    disposed = true;
    stop();
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutation.disconnect();
    viewport.removeEventListener("pointerenter", enter);
    viewport.removeEventListener("pointerleave", leave);
    viewport.removeEventListener("pointercancel", leave);
    focusTarget.removeEventListener("focus", focus);
    focusTarget.removeEventListener("blur", blur);
    reduced.removeEventListener("change", play);
    document.removeEventListener("visibilitychange", visibility);
    document.fonts?.removeEventListener("loadingdone", schedule);
  };
}
