import { useState, useId } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
export function ProgressRing({
  progress,
  name,
  waiting = false,
}: {
  progress: number;
  name: string;
  waiting?: boolean;
}) {
  const { t } = useTranslation();
  const triggerId = useId();
  const [open, setOpen] = useState(false);
  const percent = Math.round(progress * 100);
  return (
    <>
      <Tooltip open={open} onOpenChange={setOpen} triggerId={triggerId}>
        <TooltipTrigger
          id={triggerId}
          closeOnClick={false}
          onClick={() => setOpen(true)}
          render={
            <Button
              variant="ghost"
              size="icon"
              className={`progress-ring ${waiting ? "is-waiting" : ""}`}
              aria-label={`${t(waiting ? "waiting" : "converting")} ${name} · ${percent} %`}
            />
          }
        >
          <svg
            className="size-6"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              className="ring-track"
            />
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              pathLength="100"
              strokeDasharray={`${Math.max(waiting ? 0 : 3, percent)} 100`}
              className="ring-value"
            />
          </svg>
        </TooltipTrigger>
        <TooltipContent>{percent} %</TooltipContent>
      </Tooltip>
    </>
  );
}
