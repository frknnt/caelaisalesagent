import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  width?: "wide" | "text" | "faq";
}

const widths = {
  wide: "max-w-[85rem]",
  text: "max-w-[50rem]",
  faq: "max-w-[57rem]",
};

export function PageContainer({
  children,
  className,
  width = "wide",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-[1.125rem] sm:px-7 lg:px-10",
        widths[width],
        className,
      )}
    >
      {children}
    </div>
  );
}
