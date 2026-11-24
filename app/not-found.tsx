import { Search } from "lucide-react";
import type { Metadata } from "next";

import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="pt-10 pb-20 sm:pt-20 sm:pb-32">
      <PageHero
        before="This Page Is"
        icon={Search}
        after="Not Here"
        description="The address may be wrong, or the page may have moved. These are good places to continue."
      >
        <ButtonLink href="/" size="lg">
          Go to Home
        </ButtonLink>
        <ButtonLink href="/support" variant="quiet">
          Visit Support
        </ButtonLink>
      </PageHero>
    </div>
  );
}
