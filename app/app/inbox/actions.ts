"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthorization } from "@/lib/auth/guard";
import { createClient } from "@/lib/supabase/server";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function target(formData: FormData) {
  const conversationId = value(formData, "conversationId");
  const version = Number(value(formData, "version"));
  if (
    !uuid.test(conversationId) ||
    !Number.isSafeInteger(version) ||
    version < 0
  )
    redirect("/app/inbox?error=INVALID_ACTION");
  return { conversationId, version };
}

function done(conversationId: string, notice: string): never {
  revalidatePath("/app/inbox");
  redirect(`/app/inbox?conversation=${conversationId}&notice=${notice}`);
}

function failed(conversationId: string, code: string): never {
  redirect(
    `/app/inbox?conversation=${conversationId}&error=${encodeURIComponent(code)}`,
  );
}

export async function takeOverConversation(formData: FormData) {
  await requireAuthorization("inbox:manage");
  const { conversationId, version } = target(formData);
  const reason = value(formData, "reason");
  const client = await createClient();
  const { error } = await client.rpc("inbox_takeover", {
    p_conversation_id: conversationId,
    p_expected_version: version,
    p_reason: reason,
    p_sla_minutes: 15,
  });
  if (error)
    failed(
      conversationId,
      error.code === "40001" ? "ASSIGNMENT_CONFLICT" : "TAKEOVER_FAILED",
    );
  done(conversationId, "taken-over");
}

export async function releaseConversation(formData: FormData) {
  await requireAuthorization("inbox:manage");
  const { conversationId, version } = target(formData);
  const { error } = await (
    await createClient()
  ).rpc("inbox_release_to_bot", {
    p_conversation_id: conversationId,
    p_expected_version: version,
  });
  if (error)
    failed(
      conversationId,
      error.code === "40001" ? "ASSIGNMENT_CONFLICT" : "RELEASE_FAILED",
    );
  done(conversationId, "released");
}

export async function closeConversation(formData: FormData) {
  await requireAuthorization("inbox:manage");
  const { conversationId, version } = target(formData);
  const { error } = await (
    await createClient()
  ).rpc("inbox_close_conversation", {
    p_conversation_id: conversationId,
    p_expected_version: version,
  });
  if (error)
    failed(
      conversationId,
      error.code === "40001" ? "ASSIGNMENT_CONFLICT" : "CLOSE_FAILED",
    );
  redirect("/app/inbox?notice=closed");
}

export async function sendRepresentativeReply(formData: FormData) {
  await requireAuthorization("inbox:manage");
  const { conversationId } = target(formData);
  const body = value(formData, "body");
  if (!body || body.length > 4000) failed(conversationId, "INVALID_REPLY");
  const { error } = await (
    await createClient()
  ).rpc("inbox_send_reply", {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) failed(conversationId, "REPLY_FAILED");
  done(conversationId, "reply-sent");
}

export async function addInternalNote(formData: FormData) {
  await requireAuthorization("inbox:manage");
  const { conversationId } = target(formData);
  const body = value(formData, "body");
  if (!body || body.length > 2000) failed(conversationId, "INVALID_NOTE");
  const { error } = await (
    await createClient()
  ).rpc("inbox_add_note", {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) failed(conversationId, "NOTE_FAILED");
  done(conversationId, "note-added");
}

export async function markConversationRead(formData: FormData) {
  await requireAuthorization("inbox:manage");
  const { conversationId } = target(formData);
  const { error } = await (
    await createClient()
  ).rpc("inbox_mark_read", {
    p_conversation_id: conversationId,
  });
  if (error) failed(conversationId, "MARK_READ_FAILED");
  done(conversationId, "read");
}
