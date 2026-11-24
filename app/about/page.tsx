import { Handshake } from "lucide-react";

import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { MessageBubble } from "@/components/product/MessageBubble";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "About",
  description:
    "Why we are building Cael AI Sales Agent, and the rules we hold ourselves to.",
  path: "/about",
});

const beliefs = [
  {
    title: "An agent should introduce itself",
    description:
      "People deserve to know when they are talking to software. Cael says so in its first message.",
  },
  {
    title: "Commercial facts need an owner",
    description:
      "Prices, discounts, and availability belong to your systems and your team. The agent reads them or stays quiet.",
  },
  {
    title: "The best answer is sometimes a person",
    description:
      "Handoff is not a failure state. It is the point where a conversation becomes a relationship.",
  },
  {
    title: "Status should be honest",
    description:
      "If something is still being built, we write that it is still being built.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        before="Sales Help That"
        icon={Handshake}
        after="Knows Its Limits"
        description="Cael is an independent, web-first product for teams whose sales start with a question."
      />
      <PageContainer className="pb-8">
        <div className="rounded-panel border-line grid overflow-hidden border lg:grid-cols-2">
          <div className="p-8 sm:p-14">
            <h2 className="display-md font-normal">Why we are building this</h2>
            <p className="text-body mt-5 text-[1.0625rem]">
              Good prospects leave when nobody answers. Reps lose hours to
              questions that have already been answered somewhere. Most chat
              tools solve the first problem by making the second one worse.
            </p>
            <p className="text-body mt-4 text-[1.0625rem]">
              Cael takes the first reply, shows its source, and passes the
              conversation on with its context intact. The decision stays with
              your team.
            </p>
          </div>
          <div
            role="img"
            aria-label="Example: a visitor asks for a discount, and the agent says a person decides that and brings in a rep, who replies."
            className="flex flex-col justify-center gap-3 bg-[radial-gradient(60%_80%_at_100%_100%,rgb(251_160_11/0.4),transparent),radial-gradient(50%_70%_at_0%_0%,rgb(51_195_222/0.4),transparent)] bg-[#eceef1] p-8 sm:p-14"
          >
            <MessageBubble from="visitor">
              Can you give us a discount?
            </MessageBubble>
            <MessageBubble from="agent" className="[&>div]:bg-paper">
              I’m an AI agent, so that is not my decision. I can bring in Jonas,
              who can answer.
            </MessageBubble>
            <MessageBubble from="rep">
              Hi, Jonas here. Happy to talk it through.
            </MessageBubble>
          </div>
        </div>
      </PageContainer>
      <Section labelledBy="beliefs-heading">
        <h2 id="beliefs-heading" className="display-md font-normal">
          What we hold ourselves to
        </h2>
        <dl className="divide-line border-line mt-8 divide-y border-y">
          {beliefs.map((item) => (
            <div
              key={item.title}
              className="grid gap-2 py-7 lg:grid-cols-[1fr_1.4fr] lg:gap-16"
            >
              <dt className="font-display text-xl font-medium">{item.title}</dt>
              <dd className="text-body text-[1.0625rem]">{item.description}</dd>
            </div>
          ))}
        </dl>
      </Section>
      <FinalCta />
    </>
  );
}
