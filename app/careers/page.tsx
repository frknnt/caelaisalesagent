import { BriefcaseBusiness } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Careers",
  description:
    "How we work at Cael, and how to introduce yourself when no roles are listed.",
  path: "/careers",
});

const ways = [
  {
    title: "Small, finished pieces",
    description:
      "We ship one thing at a time, with tests that prove it works before it counts as done.",
  },
  {
    title: "Plain writing",
    description:
      "Decisions are written down. Claims come with evidence or they are left out.",
  },
  {
    title: "Care for the person on the other side",
    description:
      "Every feature is judged from the visitor’s seat as well as the rep’s.",
  },
];

export default function CareersPage() {
  return (
    <>
      <PageHero
        before="Work on Conversations"
        icon={BriefcaseBusiness}
        after="That Matter"
        description="There are no open roles listed right now. If the way we work suits you, introduce yourself anyway."
      >
        <ButtonLink href="/contact?topic=careers" size="lg">
          Introduce Yourself
        </ButtonLink>
      </PageHero>
      <PageContainer className="pb-16">
        <Panel>
          <PanelHeader
            title="How we work"
            description="Three habits you would notice in your first week."
          />
          <div className="grid gap-1.5 sm:gap-2 md:grid-cols-3">
            {ways.map((item) => (
              <Card key={item.title} className="p-8 sm:p-10">
                <h3 className="text-xl font-medium">{item.title}</h3>
                <p className="text-body mt-2">{item.description}</p>
              </Card>
            ))}
          </div>
        </Panel>
      </PageContainer>
    </>
  );
}
