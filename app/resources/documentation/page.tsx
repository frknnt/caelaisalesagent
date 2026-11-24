import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageContainer } from "@/components/layout/PageContainer";
import { Badge } from "@/components/ui/Badge";
import { agentModes } from "@/data/home-content";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Documentation",
  description:
    "Core concepts, agent modes, roles, invitations, handoff, and current availability for Cael AI Sales Agent.",
  path: "/resources/documentation",
});

const contents = [
  { id: "overview", label: "Overview" },
  { id: "concepts", label: "Core concepts" },
  { id: "modes", label: "Agent modes" },
  { id: "roles", label: "Roles" },
  { id: "invitations", label: "Invitations" },
  { id: "handoff", label: "Human handoff" },
  { id: "availability", label: "Availability" },
];

const concepts = [
  {
    term: "Workspace",
    description:
      "Your organization in Cael. Members, sites, and settings belong to one workspace and are isolated from every other.",
  },
  {
    term: "Site",
    description:
      "A website connected to a workspace. Each site has its own domains and settings.",
  },
  {
    term: "Approved source",
    description:
      "A page or document your team allows the agent to answer from. Visitor messages and uploads are never treated as instructions.",
  },
  {
    term: "Lead score",
    description:
      "A total calculated from criteria you define. It is rule-based, so the same answers give the same score.",
  },
];

const roleRows = [
  {
    role: "Owner",
    content: "Read and write",
    members: "Manage members and invitations",
    organization: "Update",
  },
  {
    role: "Admin",
    content: "Read and write",
    members: "Manage members and invitations",
    organization: "Update",
  },
  {
    role: "Editor",
    content: "Read and write",
    members: "No access",
    organization: "No access",
  },
  {
    role: "Sales",
    content: "Read",
    members: "No access",
    organization: "No access",
  },
  {
    role: "Viewer",
    content: "Read",
    members: "No access",
    organization: "No access",
  },
];

const availability = [
  { label: "Sign-in and five server-checked roles", ready: true },
  { label: "Workspace and invitation screens", ready: false },
  { label: "Workspace data isolation", ready: true },
  { label: "AI agent and website widget", ready: false },
  { label: "Inbox and live handoff", ready: false },
  { label: "CRM, calendar, and messaging connections", ready: false },
];

export default function DocumentationPage() {
  return (
    <PageContainer className="pt-8 pb-16 sm:pt-12">
      <Link
        href="/resources"
        className="text-body hover:text-ink inline-flex min-h-11 items-center gap-2 font-medium"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        All resources
      </Link>
      <h1 className="display-lg mt-4 font-normal">Documentation</h1>
      <p className="text-body mt-4 max-w-2xl text-[1.0625rem]">
        The ideas and rules behind Cael, and what you can use today.
      </p>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-16">
        <nav
          aria-label="On this page"
          className="border-line bg-mist rounded-card h-fit border p-3 lg:sticky lg:top-28"
        >
          <ul>
            {contents.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="hover:bg-paper flex min-h-11 items-center rounded-2xl px-4 font-medium"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl">
          <section id="overview" className="prose-cael">
            <h2 className="mt-0!">Overview</h2>
            <p>
              Cael is an AI sales agent for your website and, as channels are
              enabled, for messaging and email. It tells visitors it is an AI,
              answers from approved sources, qualifies against your rules, and
              hands conversations to a person.
            </p>
            <p>
              New here? Start with{" "}
              <Link
                href="/resources/launch-your-first-agent"
                className="text-violet-ink font-medium underline underline-offset-4"
              >
                Launch your first agent
              </Link>
              .
            </p>
          </section>

          <section id="concepts" className="prose-cael">
            <h2>Core concepts</h2>
            <dl className="divide-line border-line mt-5 divide-y border-y">
              {concepts.map((concept) => (
                <div
                  key={concept.term}
                  className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
                >
                  <dt className="font-semibold">{concept.term}</dt>
                  <dd className="text-[#3b404a]">{concept.description}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="modes" className="prose-cael">
            <h2>Agent modes</h2>
            <p>
              A mode sets the agent’s job and its handoff point. You can run
              more than one mode with shared context.
            </p>
            <dl className="divide-line border-line mt-5 divide-y border-y">
              {agentModes.map((mode) => (
                <div
                  key={mode.id}
                  className="grid gap-1 py-5 sm:grid-cols-[11rem_1fr] sm:gap-6"
                >
                  <dt className="font-semibold">{mode.name}</dt>
                  <dd className="text-[#3b404a]">
                    {mode.summary} Hands over:{" "}
                    {mode.handsOver.charAt(0).toLowerCase() +
                      mode.handsOver.slice(1)}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="roles" className="prose-cael">
            <h2>Roles</h2>
            <p>
              Access is checked on the server against current membership for
              every request, not against what the browser claims.
            </p>
            <div
              className="border-line rounded-card mt-5 overflow-x-auto border"
              role="region"
              aria-label="Role permissions"
              tabIndex={0}
            >
              <table className="w-full min-w-[36rem] text-left">
                <thead className="bg-fog">
                  <tr>
                    {["Role", "Content", "Members", "Organization"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="px-5 py-4 font-semibold"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-line divide-y">
                  {roleRows.map((row) => (
                    <tr key={row.role}>
                      <th scope="row" className="px-5 py-4 font-semibold">
                        {row.role}
                      </th>
                      <td className="px-5 py-4">{row.content}</td>
                      <td className="px-5 py-4">{row.members}</td>
                      <td className="px-5 py-4">{row.organization}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="invitations" className="prose-cael">
            <h2>Invitations</h2>
            <p>
              Owners and admins can invite teammates as admin, editor, sales, or
              viewer. An invitation expires after seven days and works only for
              the email address it was sent to. Pending invitations can be
              revoked.
            </p>
          </section>

          <section id="handoff" className="prose-cael">
            <h2>Human handoff</h2>
            <p>
              A visitor can ask for a person at any time. When a rep takes over,
              the agent stops replying. If the agent has no approved source for
              an answer, it says so and offers a person.
            </p>
            <p>
              For triggers and summary formats, read{" "}
              <Link
                href="/resources/design-a-human-handoff"
                className="text-violet-ink font-medium underline underline-offset-4"
              >
                Design a handoff people trust
              </Link>
              .
            </p>
          </section>

          <section id="availability" className="prose-cael">
            <h2>Availability</h2>
            <p>
              Cael is in early access. This list is updated when something
              ships.
            </p>
            <ul className="list-none! pl-0!">
              {availability.map((item) => (
                <li
                  key={item.label}
                  className="border-line flex flex-wrap items-center justify-between gap-3 border-b py-4"
                >
                  <span className="text-ink font-medium">{item.label}</span>
                  <Badge tone={item.ready ? "mint" : "neutral"}>
                    {item.ready ? "Available" : "In development"}
                  </Badge>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </PageContainer>
  );
}
