import { memo, useCallback, type ComponentProps } from "react";
import { observeMarquee } from "@/adapters/presentation/marquee";
import { cn } from "@/lib/utils";
export const MarqueeText = memo(function MarqueeText({
  children,
  className,
  as: Tag = "p",
  ...props
}: Omit<ComponentProps<"p">, "children"> & { children: string; as?: "p" | "span" }) {
  const attach = useCallback((node: HTMLElement | null) => {
    const text = node?.querySelector<HTMLElement>(".marquee-text");
    if (node && text) return observeMarquee(node, text);
  }, []);
  return (
    <Tag {...props} ref={attach} className={cn("marquee-viewport", className)}>
      <span className="marquee-text">{children}</span>
    </Tag>
  );
});
