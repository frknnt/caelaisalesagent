import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

interface IconButtonProps extends Omit<ComponentProps<"button">, "aria-label"> {
  label: string;
}

export function IconButton({
  label,
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        "bg-ink text-paper shadow-button inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,translate,opacity] duration-200 hover:bg-[#2a2c33] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      {...props}
    />
  );
}
