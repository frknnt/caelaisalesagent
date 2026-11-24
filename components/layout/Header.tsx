import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { routes } from "@/data/navigation";

import { DesktopNavigation } from "./DesktopNavigation";
import { MobileNavigation } from "./MobileNavigation";
import { PageContainer } from "./PageContainer";

export function Header() {
  return (
    <header className="bg-paper sticky top-0 z-40">
      <PageContainer className="flex h-20 items-center justify-between gap-4 lg:grid lg:h-[6.25rem] lg:grid-cols-[1fr_auto_1fr]">
        <Logo />
        <DesktopNavigation />
        <div className="flex items-center justify-end gap-2.5 sm:gap-3">
          <ButtonLink
            href={routes.signIn}
            variant="outline"
            className="max-sm:hidden"
          >
            Sign In
          </ButtonLink>
          <ButtonLink
            href={routes.startFree}
            className="whitespace-nowrap max-[22rem]:hidden"
          >
            Start Free
          </ButtonLink>
          <MobileNavigation />
        </div>
      </PageContainer>
    </header>
  );
}
