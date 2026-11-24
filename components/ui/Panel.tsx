import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PanelProps {
  children: ReactNode;
  className?: string;
}

/** Large rounded gray container that holds white cards. */
export function Panel({ children, className }: PanelProps) {
  return (
    <div className={cn("panel-surface rounded-panel p-1.5 sm:p-2", className)}>
      {children}
    </div>
  );
}

interface PanelHeaderProps {
  title: string;
  description: string;
  layout?: "split" | "stacked";
  id?: string;
}

export function PanelHeader({
  title,
  description,
  layout = "split",
  id,
}: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "px-5 pt-9 pb-8 sm:px-9 sm:pt-11 sm:pb-10",
        layout === "split" &&
          "gap-x-10 gap-y-3 lg:flex lg:items-center lg:justify-between",
      )}
    >
      <h2 id={id} className="display-md font-normal">
        {title}
      </h2>
      <p
        className={cn(
          "mt-3 text-[#454b55]",
          layout === "split"
            ? "lg:mt-0 lg:text-right"
            : "max-w-4xl text-[1.0625rem]",
        )}
      >
        {description}
      </p>
    </div>
  );
}
