import { Clock, MessageCircle, ShieldCheck } from "lucide-react";

import { ContactForm } from "@/components/forms/ContactForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { Disc } from "@/components/ui/Disc";
import { Panel } from "@/components/ui/Panel";
import { isContactTopic } from "@/lib/leads/validation";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Contact",
  description:
    "Book a demo or ask about plans, integrations, security, or support for Cael AI Sales Agent.",
  path: "/contact",
});

interface ContactPageProps {
  searchParams: Promise<{ topic?: string | string[] }>;
}

const notes = [
  {
    icon: MessageCircle,
    title: "A person replies",
    description: "This form goes to the team, not to an agent.",
  },
  {
    icon: Clock,
    title: "Demos follow your case",
    description: "Tell us one conversation you would like to improve.",
  },
  {
    icon: ShieldCheck,
    title: "Only what we need",
    description: "Please leave passwords and customer records out.",
  },
];

export default async function ContactPage({ searchParams }: ContactPageProps) {
  const { topic } = await searchParams;
  const initialTopic = isContactTopic(topic) ? topic : "";

  return (
    <PageContainer className="pt-8 pb-14 sm:pt-12">
      <Panel className="grid gap-1.5 sm:gap-2 lg:grid-cols-[1fr_1.5fr]">
        <div className="px-5 pt-8 pb-8 sm:px-9 sm:pt-11">
          <h1 className="display-lg font-normal">
            {initialTopic === "demo" ? "Book a demo" : "Talk to the team"}
          </h1>
          <p className="mt-4 text-[1.0625rem] text-[#454b55]">
            {initialTopic === "demo"
              ? "See Cael handle a conversation like yours, then decide."
              : "Questions about plans, integrations, security, or your account."}
          </p>
          <ul className="mt-9 space-y-6">
            {notes.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <Disc size="sm">
                  <Icon className="size-5" strokeWidth={1.9} />
                </Disc>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-[#454b55]">{description}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border-line bg-paper border p-5 sm:p-9">
          <ContactForm
            key={initialTopic || "none"}
            initialTopic={initialTopic}
          />
        </div>
      </Panel>
    </PageContainer>
  );
}
