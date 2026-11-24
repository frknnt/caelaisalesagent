import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { SectionHeading } from "@/components/ui/SectionHeading";

import { PageContainer } from "./PageContainer";

interface PageHeroProps {
  before: string;
  icon?: LucideIcon;
  after?: string;
  description: string;
  children?: ReactNode;
}

export function PageHero({
  before,
  icon,
  after,
  description,
  children,
}: PageHeroProps) {
  return (
    <div className="pt-8 pb-8 sm:pt-12 sm:pb-10">
      <PageContainer>
        <SectionHeading
          level={1}
          wide
          before={before}
          description={description}
          {...(icon ? { icon } : {})}
          {...(after ? { after } : {})}
        />
        {children ? (
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            {children}
          </div>
        ) : null}
      </PageContainer>
    </div>
  );
}
