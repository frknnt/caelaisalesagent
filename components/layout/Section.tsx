import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { PageContainer } from "./PageContainer";

interface SectionProps {
  children: ReactNode;
  className?: string;
  containerClassName?: string;
  width?: "wide" | "text" | "faq";
  labelledBy?: string;
}

export function Section({
  children,
  className,
  containerClassName,
  width = "wide",
  labelledBy,
}: SectionProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={cn("py-10 sm:py-14 lg:py-16", className)}
    >
      <PageContainer
        width={width}
        {...(containerClassName ? { className: containerClassName } : {})}
      >
        {children}
      </PageContainer>
    </section>
  );
}
