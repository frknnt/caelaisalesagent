import {
  Archive,
  History,
  Plug,
  ShieldCheck,
  UserCheck,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { StaggerGrid } from "@/components/motion/StaggerGrid";
import { ControlSwitch } from "@/components/product/ControlSwitch";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Disc } from "@/components/ui/Disc";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Security",
  description:
    "How Cael approaches access, data separation, handoff, retention, and activity history, and what is available today.",
  path: "/security",
});

interface Control {
  icon: LucideIcon;
  title: string;
  description: string;
  ready: boolean;
}

const controls: Control[] = [
  {
    icon: Users,
    title: "Role-based access",
    description:
      "Five roles decide who can read, edit, and manage. Every request is checked against current membership on the server.",
    ready: true,
  },
  {
    icon: ShieldCheck,
    title: "Workspace separation",
    description:
      "Database rules keep each organization’s records separate, with tests for both allowed and denied access.",
    ready: true,
  },
  {
    icon: Plug,
    title: "Secure integration boundaries",
    description:
      "Secret keys stay on the server and are never sent to the browser or written to logs.",
    ready: true,
  },
  {
    icon: UserCheck,
    title: "Controlled human handoff",
    description:
      "Visitors can always reach a person. When a rep takes over, the agent stops replying.",
    ready: false,
  },
  {
    icon: History,
    title: "Audit-friendly activity history",
    description:
      "A record of who changed an agent, a source, or a rule, and when.",
    ready: false,
  },
  {
    icon: Archive,
    title: "Configurable data retention",
    description:
      "Choose how long conversations are kept for each workspace and purpose.",
    ready: false,
  },
  {
    icon: Workflow,
    title: "Permission-aware workflows",
    description:
      "Actions with real consequences follow fixed rules and need the right role.",
    ready: false,
  },
];

const principles = [
  {
    title: "Visitor text is data, not instruction",
    description:
      "Messages and uploads are treated as untrusted. They cannot change how the agent is set up.",
  },
  {
    title: "Consent is recorded, not assumed",
    description:
      "Marketing permission is stored with its purpose, wording version, time, and source. Without it, there is no marketing.",
  },
  {
    title: "Failure means stop",
    description:
      "On a timeout or an unclear result, the agent takes no action and hands over.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <div className="pt-6" />
      <ControlSwitch />
      <PageHero
        before="Your Conversations,"
        icon={ShieldCheck}
        after="Your Control"
        description="What protects your data in Cael, which controls you can use today, and which are still being built."
      />

      <section aria-labelledby="controls-heading" className="pb-8">
        <PageContainer>
          <Panel>
            <PanelHeader
              id="controls-heading"
              title="Controls"
              description="Each one shows its current status."
            />
            <StaggerGrid className="grid gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-6">
              {controls.map(
                ({ icon: Icon, title, description, ready }, index) => (
                  <div
                    key={title}
                    className={
                      index < 3
                        ? "lg:col-span-2"
                        : "last:sm:max-lg:col-span-2 lg:col-span-3"
                    }
                  >
                    <Card className="h-full p-8 sm:p-10">
                      <div className="flex items-start justify-between gap-4">
                        <Disc>
                          <Icon className="size-6" strokeWidth={1.9} />
                        </Disc>
                        <Badge tone={ready ? "mint" : "neutral"}>
                          {ready ? "Available" : "In development"}
                        </Badge>
                      </div>
                      <h3 className="mt-6 text-xl font-medium">{title}</h3>
                      <p className="text-body mt-2">{description}</p>
                    </Card>
                  </div>
                ),
              )}
            </StaggerGrid>
          </Panel>
        </PageContainer>
      </section>

      <Section labelledBy="principles-heading">
        <h2 id="principles-heading" className="display-md font-normal">
          Rules the agent cannot override
        </h2>
        <dl className="divide-line border-line mt-8 divide-y border-y">
          {principles.map((item) => (
            <div
              key={item.title}
              className="grid gap-2 py-7 lg:grid-cols-[1fr_1.4fr] lg:gap-16"
            >
              <dt className="font-display text-xl font-medium">{item.title}</dt>
              <dd className="text-body text-[1.0625rem]">{item.description}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-9">
          <ButtonLink href="/contact?topic=security" size="lg">
            Ask a Security Question
          </ButtonLink>
        </div>
      </Section>

      <FinalCta />
    </>
  );
}
