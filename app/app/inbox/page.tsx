import type { Metadata } from "next";
import Link from "next/link";

import { SubmitButton } from "@/components/forms/SubmitButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { requireAuthorization } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

import {
  addInternalNote,
  closeConversation,
  markConversationRead,
  releaseConversation,
  sendRepresentativeReply,
  takeOverConversation,
} from "./actions";
import { InboxLiveRefresh } from "./_components/InboxLiveRefresh";

export const metadata: Metadata = {
  title: "Conversation inbox",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;
type Conversation = {
  id: string;
  site_id: string;
  status: string;
  handoff_state: string;
  assigned_to: string | null;
  assignment_version: number;
  handoff_reason: string | null;
  sla_due_at: string | null;
  first_human_response_at: string | null;
  last_message_at: string;
  summary: string | null;
  lead_context: unknown;
};

const one = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
const date = (value: string) =>
  new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date(value));
const hasObjectValues = (value: unknown) =>
  Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length,
  );

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Params;
}) {
  const context = await requireAuthorization("inbox:manage");
  const organizationId = context.activeMembership.organization_id;
  const userId = context.user.id;
  const params = await searchParams;
  const query = one(params.q).toLocaleLowerCase("tr").slice(0, 120);
  const filter = one(params.filter) || "open";
  const assignment = one(params.assignment) || "all";
  const selectedId = one(params.conversation);
  const client = await createClient();

  const [{ data: conversationRows }, { data: profiles }, { data: reads }] =
    await Promise.all([
      client
        .from("conversations")
        .select(
          "id,site_id,status,handoff_state,assigned_to,assignment_version,handoff_reason,sla_due_at,first_human_response_at,last_message_at,summary,lead_context",
        )
        .eq("organization_id", organizationId)
        .order("last_message_at", { ascending: false })
        .limit(100),
      client.from("profiles").select("id,display_name").limit(200),
      client
        .from("conversation_reads")
        .select("conversation_id,last_read_at")
        .eq("organization_id", organizationId)
        .eq("user_id", userId),
    ]);
  const conversations = (conversationRows ?? []) as Conversation[];
  const ids = conversations.map(({ id }) => id);
  const { data: recentMessages } = ids.length
    ? await client
        .from("messages")
        .select("conversation_id,body,created_at,sender_type")
        .eq("organization_id", organizationId)
        .in("conversation_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };
  const latest = new Map<string, { body: string; created_at: string }>();
  const searchableTranscript = new Map<string, string>();
  for (const message of recentMessages ?? []) {
    searchableTranscript.set(
      message.conversation_id,
      `${searchableTranscript.get(message.conversation_id) ?? ""} ${message.body}`,
    );
    if (!latest.has(message.conversation_id))
      latest.set(message.conversation_id, message);
  }
  const readAt = new Map(
    (reads ?? []).map((item) => [item.conversation_id, item.last_read_at]),
  );
  const people = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile.display_name]),
  );
  const visible = conversations.filter((conversation) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "handoff"
        ? conversation.handoff_state === "human" &&
          conversation.status === "open"
        : conversation.status === filter);
    const matchesAssignment =
      assignment === "all" ||
      (assignment === "mine"
        ? conversation.assigned_to === userId
        : assignment === "unassigned"
          ? !conversation.assigned_to
          : true);
    const haystack =
      `${searchableTranscript.get(conversation.id) ?? ""} ${conversation.summary ?? ""} ${conversation.handoff_reason ?? ""}`.toLocaleLowerCase(
        "tr",
      );
    return (
      matchesFilter && matchesAssignment && (!query || haystack.includes(query))
    );
  });
  const selected =
    conversations.find(({ id }) => id === selectedId) ?? visible[0] ?? null;
  const detail = selected
    ? await Promise.all([
        client
          .from("messages")
          .select(
            "id,body,created_at,sender_type,author_user_id,citations,handoff",
          )
          .eq("organization_id", organizationId)
          .eq("conversation_id", selected.id)
          .order("created_at"),
        client
          .from("conversation_notes")
          .select("id,body,created_at,author_user_id")
          .eq("organization_id", organizationId)
          .eq("conversation_id", selected.id)
          .order("created_at"),
        client
          .from("conversation_tool_events")
          .select("id,tool_name,outcome,summary,created_at")
          .eq("organization_id", organizationId)
          .eq("conversation_id", selected.id)
          .order("created_at"),
      ])
    : null;
  const messages = detail?.[0].data ?? [];
  const notes = detail?.[1].data ?? [];
  const tools = detail?.[2].data ?? [];
  const notice = one(params.notice);
  const error = one(params.error);
  const input =
    "border-line focus-ring min-h-11 w-full border bg-white px-3 py-2";

  return (
    <PageContainer width="wide" className="pt-6 pb-12">
      <header className="border-line mb-5 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.14em] text-violet-ink">
            Sales workspace
          </p>
          <h1 className="display-md mt-1 font-normal">Conversation inbox</h1>
          <p className="text-body mt-2">
            Take over with the full transcript, lead context and tool history.
          </p>
          <InboxLiveRefresh />
        </div>
        <Link className="focus-ring text-link" href="/app">
          Back to workspace
        </Link>
      </header>
      {notice ? (
        <p
          role="status"
          className="mb-4 border border-mint bg-mint-soft px-4 py-3"
        >
          Conversation updated: {notice}.
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mb-4 border border-rose-ink bg-rose-soft px-4 py-3"
        >
          Action failed: {error}. Refresh before retrying.
        </p>
      ) : null}
      <form
        className="border-line mb-5 grid gap-3 border bg-mist p-4 sm:grid-cols-[1fr_auto_auto]"
        aria-label="Inbox filters"
      >
        <label className="grid gap-1 text-sm font-medium">
          Search transcript
          <input
            className={input}
            name="q"
            defaultValue={query}
            placeholder="Search messages or handoff reason"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Status
          <select className={input} name="filter" defaultValue={filter}>
            <option value="open">Open</option>
            <option value="handoff">Human handoff</option>
            <option value="closed">Closed</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Assignment
          <select className={input} name="assignment" defaultValue={assignment}>
            <option value="all">Everyone</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned queue</option>
          </select>
        </label>
        <button
          className="focus-ring min-h-11 border border-ink bg-ink px-5 text-white sm:col-start-3"
          type="submit"
        >
          Apply filters
        </button>
      </form>
      <div className="grid min-h-[42rem] gap-4 lg:grid-cols-[22rem_minmax(0,1fr)_19rem]">
        <section
          aria-label="Conversations"
          className="border-line overflow-hidden border bg-paper"
        >
          <div className="border-line flex items-center justify-between border-b p-4">
            <h2 className="text-lg font-medium">Queue</h2>
            <span className="rounded-full bg-violet-soft px-2.5 py-1 text-xs font-semibold text-violet-ink">
              {visible.length}
            </span>
          </div>
          {!visible.length ? (
            <p className="p-6 text-body">
              No conversations match these filters.
            </p>
          ) : (
            <ul>
              {visible.map((conversation) => {
                const unread =
                  !readAt.get(conversation.id) ||
                  new Date(readAt.get(conversation.id)!) <
                    new Date(conversation.last_message_at);
                const active = selected?.id === conversation.id;
                return (
                  <li key={conversation.id} className="border-line border-b">
                    <Link
                      className={`focus-ring block p-4 ${active ? "bg-violet-soft" : "hover:bg-mist"}`}
                      href={`/app/inbox?conversation=${conversation.id}&filter=${filter}&assignment=${assignment}&q=${encodeURIComponent(query)}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {conversation.handoff_state === "human"
                            ? "Human handoff"
                            : "AI conversation"}
                        </span>
                        {unread ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full bg-violet"
                            aria-label="Unread"
                          />
                        ) : null}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-sm text-body">
                        {latest.get(conversation.id)?.body ??
                          "Conversation started"}
                      </span>
                      <span className="mt-2 block text-xs text-body">
                        {date(conversation.last_message_at)} ·{" "}
                        {conversation.assigned_to
                          ? (people.get(conversation.assigned_to) ?? "Assigned")
                          : "Team queue"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section
          className="border-line border bg-paper"
          aria-label="Conversation transcript"
        >
          {!selected ? (
            <div className="grid min-h-80 place-items-center p-8 text-center">
              <div>
                <h2 className="text-xl font-medium">Inbox is clear</h2>
                <p className="mt-2 text-body">
                  New or handed-off conversations will appear here.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="border-line flex flex-wrap items-center justify-between gap-3 border-b p-4">
                <div>
                  <h2 className="text-lg font-medium">Transcript</h2>
                  <p className="text-sm text-body">
                    {selected.handoff_state === "human"
                      ? `Human control · ${selected.handoff_reason ?? "manual"}`
                      : "Bot control"}
                  </p>
                </div>
                <form action={markConversationRead}>
                  <input
                    type="hidden"
                    name="conversationId"
                    value={selected.id}
                  />
                  <input
                    type="hidden"
                    name="version"
                    value={selected.assignment_version}
                  />
                  <SubmitButton label="Mark read" pendingLabel="Saving…" />
                </form>
              </div>
              <ol
                className="max-h-[34rem] space-y-4 overflow-y-auto p-4"
                aria-label="Messages"
              >
                {messages.map((message) => (
                  <li
                    key={message.id}
                    className={`max-w-[85%] border p-3 ${message.sender_type === "visitor" ? "ml-auto border-violet bg-violet-soft" : message.sender_type === "human" ? "border-mint bg-mint-soft" : "border-line bg-mist"}`}
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide">
                      {message.sender_type === "visitor"
                        ? "Visitor"
                        : message.sender_type === "human"
                          ? (people.get(message.author_user_id ?? "") ??
                            "Representative")
                          : "Cael AI"}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {message.body || "Reply could not be delivered."}
                    </p>
                    <time className="mt-2 block text-xs text-body">
                      {date(message.created_at)}
                    </time>
                  </li>
                ))}
              </ol>
              {selected.status === "open" &&
              selected.handoff_state === "human" &&
              selected.assigned_to === userId ? (
                <form
                  action={sendRepresentativeReply}
                  className="border-line grid gap-3 border-t p-4"
                >
                  <input
                    type="hidden"
                    name="conversationId"
                    value={selected.id}
                  />
                  <input
                    type="hidden"
                    name="version"
                    value={selected.assignment_version}
                  />
                  <label className="grid gap-1 text-sm font-medium">
                    Reply as representative
                    <textarea
                      className={`${input} min-h-24`}
                      name="body"
                      maxLength={4000}
                      required
                    />
                  </label>
                  <SubmitButton label="Send reply" pendingLabel="Sending…" />
                </form>
              ) : null}
            </>
          )}
        </section>
        <aside className="space-y-4" aria-label="Conversation context">
          {!selected ? null : (
            <>
              <section className="border-line border bg-paper p-4">
                <h2 className="text-lg font-medium">Ownership</h2>
                <dl className="mt-3 grid gap-2 text-sm">
                  <div>
                    <dt className="text-body">Assigned to</dt>
                    <dd>
                      {selected.assigned_to
                        ? (people.get(selected.assigned_to) ?? "Representative")
                        : "Team fallback queue"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-body">SLA</dt>
                    <dd>
                      {selected.first_human_response_at
                        ? "Responded"
                        : selected.sla_due_at
                          ? date(selected.sla_due_at)
                          : "Not started"}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 grid gap-2">
                  {selected.status === "open" &&
                  selected.handoff_state === "bot" ? (
                    <form action={takeOverConversation}>
                      <input
                        type="hidden"
                        name="conversationId"
                        value={selected.id}
                      />
                      <input
                        type="hidden"
                        name="version"
                        value={selected.assignment_version}
                      />
                      <label className="grid gap-1 text-sm font-medium">
                        Handoff reason
                        <select
                          className={input}
                          name="reason"
                          defaultValue="sales_requested"
                        >
                          <option value="sales_requested">
                            Sales requested
                          </option>
                          <option value="visitor_requested">
                            Visitor requested
                          </option>
                          <option value="high_intent">High intent</option>
                          <option value="risk_detected">Risk detected</option>
                        </select>
                      </label>
                      <div className="mt-2">
                        <SubmitButton
                          label="Take over"
                          pendingLabel="Claiming…"
                        />
                      </div>
                    </form>
                  ) : null}
                  {selected.status === "open" &&
                  selected.handoff_state === "human" ? (
                    <form action={releaseConversation}>
                      <input
                        type="hidden"
                        name="conversationId"
                        value={selected.id}
                      />
                      <input
                        type="hidden"
                        name="version"
                        value={selected.assignment_version}
                      />
                      <SubmitButton
                        label="Return to bot"
                        pendingLabel="Releasing…"
                      />
                    </form>
                  ) : null}
                  {selected.status === "open" ? (
                    <form action={closeConversation}>
                      <input
                        type="hidden"
                        name="conversationId"
                        value={selected.id}
                      />
                      <input
                        type="hidden"
                        name="version"
                        value={selected.assignment_version}
                      />
                      <SubmitButton
                        label="Close conversation"
                        pendingLabel="Closing…"
                      />
                    </form>
                  ) : null}
                </div>
              </section>
              <section className="border-line border bg-paper p-4">
                <h2 className="text-lg font-medium">Lead context</h2>
                {hasObjectValues(selected.lead_context) ? (
                  <pre className="mt-3 overflow-auto whitespace-pre-wrap text-xs text-body">
                    {JSON.stringify(selected.lead_context, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-3 text-sm text-body">
                    No lead context captured yet.
                  </p>
                )}
                {selected.summary ? (
                  <p className="mt-3 text-sm">{selected.summary}</p>
                ) : null}
              </section>
              <section className="border-line border bg-paper p-4">
                <h2 className="text-lg font-medium">Tool history</h2>
                {tools.length ? (
                  <ul className="mt-3 space-y-2 text-sm">
                    {tools.map((tool) => (
                      <li key={tool.id}>
                        <span className="font-medium">{tool.tool_name}</span> ·{" "}
                        {tool.outcome}
                        <pre className="whitespace-pre-wrap text-xs text-body">
                          {JSON.stringify(tool.summary)}
                        </pre>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-body">
                    No tool calls recorded.
                  </p>
                )}
              </section>
              <section className="border-line border bg-paper p-4">
                <h2 className="text-lg font-medium">Internal notes</h2>
                {notes.length ? (
                  <ul className="mt-3 space-y-3 text-sm">
                    {notes.map((note) => (
                      <li key={note.id} className="border-line border-l-2 pl-3">
                        <p>{note.body}</p>
                        <span className="text-xs text-body">
                          {people.get(note.author_user_id ?? "") ??
                            "Former teammate"}{" "}
                          · {date(note.created_at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-body">No internal notes.</p>
                )}
                <form action={addInternalNote} className="mt-4 grid gap-2">
                  <input
                    type="hidden"
                    name="conversationId"
                    value={selected.id}
                  />
                  <input
                    type="hidden"
                    name="version"
                    value={selected.assignment_version}
                  />
                  <label className="grid gap-1 text-sm font-medium">
                    Add note
                    <textarea
                      className={`${input} min-h-20`}
                      name="body"
                      maxLength={2000}
                      required
                    />
                  </label>
                  <SubmitButton label="Save note" pendingLabel="Saving…" />
                </form>
              </section>
            </>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
