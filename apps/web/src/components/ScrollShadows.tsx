import { useCallback, type ComponentProps } from "react";
import { observeScrollShadows } from "@/adapters/presentation/scroll-shadows";
import { cn } from "@/lib/utils";
export function ScrollShadows({ children, className, ...props }: ComponentProps<"div">) {
  const attach = useCallback((node: HTMLDivElement | null) => {
    const viewport = node?.querySelector<HTMLElement>("[data-scroll-viewport]");
    if (node && viewport) return observeScrollShadows(viewport, node);
  }, []);
  return (
    <div className={cn("scroll-shadow-surface", className)} {...props} ref={attach}>
      {children}
      <span className="scroll-shadow scroll-shadow-top" aria-hidden="true" />
      <span className="scroll-shadow scroll-shadow-bottom" aria-hidden="true" />
    </div>
  );
}
