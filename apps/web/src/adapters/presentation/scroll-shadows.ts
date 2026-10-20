/** Tracks real overflow without rendering React on scroll or intercepting native gestures. */
export function observeScrollShadows(viewport: HTMLElement, surface: HTMLElement): () => void {
  let frame = 0,
    disposed = false;
  let previousTop: boolean | undefined, previousBottom: boolean | undefined;
  const measure = () => {
    frame = 0;
    if (disposed) return;
    const top = viewport.scrollTop > 1;
    const bottom = viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1;
    if (top !== previousTop) {
      surface.dataset.scrollTop = String(top);
      previousTop = top;
    }
    if (bottom !== previousBottom) {
      surface.dataset.scrollBottom = String(bottom);
      previousBottom = bottom;
    }
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(measure);
  };
  const resize = new ResizeObserver(schedule);
  const observe = () => {
    resize.disconnect();
    resize.observe(viewport);
    Array.from(viewport.children).forEach((child) => resize.observe(child));
  };
  const mutation = new MutationObserver((records) => {
    if (records.some((record) => record.target === viewport)) observe();
    schedule();
  });
  observe();
  mutation.observe(viewport, { childList: true, subtree: true, characterData: true });
  viewport.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  void document.fonts?.ready.then(schedule);
  measure();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutation.disconnect();
    viewport.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
  };
}
