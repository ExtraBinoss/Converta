import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export function IconButton({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon" aria-label={label} {...props} />}>
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
export function Choice<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  displayValue,
  className = "",
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  displayValue?: string;
  className?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(value) => {
        const option = options.find((option) => option.value === value);
        if (option) onChange(option.value);
      }}
      disabled={disabled}
    >
      <SelectTrigger aria-label={label} className={className}>
        <SelectValue>
          {displayValue ?? options.find((option) => option.value === value)?.label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end" alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
