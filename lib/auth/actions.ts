"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { readRuntimeConfig } from "@/lib/env";
import { createLogger } from "@/lib/observability/logger";
import { readRequestContext } from "@/lib/observability/request-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_ORGANIZATION_COOKIE,
  assertRequestedOrganization,
  requireAuthorization,
} from "./guard";
import { roles, type OrganizationRole } from "./permissions";

function safeNext(value: FormDataEntryValue | null) {
  return typeof value === "string" &&
    value.startsWith("/") &&
    !value.startsWith("//")
    ? value
    : "/app";
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  const logger = createLogger({
    context: readRequestContext(await headers()),
  });
  if (error) {
    logger.warn("auth.login_failed", {
      code: error.code ?? "unknown",
      status: error.status ?? null,
    });
    redirect(
      `/login?error=invalid_credentials&next=${encodeURIComponent(next)}`,
    );
  }
  logger.info("auth.login_succeeded");
  redirect(next);
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  (await cookies()).delete(ACTIVE_ORGANIZATION_COOKIE);
  redirect("/login");
}

export async function switchOrganization(formData: FormData) {
  const requestedId = String(formData.get("organizationId") ?? "");
  const context = await requireAuthorization();
  if (
    !context.memberships.some((item) => item.organization_id === requestedId)
  ) {
    assertRequestedOrganization(
      requestedId,
      context.activeMembership.organization_id,
    );
  }
  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, requestedId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect("/app");
}

export async function inviteMember(formData: FormData) {
  const context = await requireAuthorization("invitations:manage");
  const organizationId = String(formData.get("organizationId") ?? "");
  assertRequestedOrganization(
    organizationId,
    context.activeMembership.organization_id,
  );
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const role = String(formData.get("role") ?? "viewer") as OrganizationRole;
  if (!roles.includes(role) || role === "owner")
    redirect("/app/team?error=invalid_role");

  const supabase = await createClient();
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabase.rpc("create_organization_invitation", {
    p_organization_id: organizationId,
    p_email: email,
    p_role: role,
    p_expires_at: expiresAt,
  });
  if (error || !data) redirect("/app/team?error=invitation_failed");

  const invitation = data as { id: string };
  const runtime = readRuntimeConfig(
    process.env,
    process.env.NODE_ENV === "production" ? "production" : "development",
  );
  if (!runtime.ok) redirect("/app/team?error=configuration");
  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    {
      redirectTo: `${runtime.value.appBaseUrl}/invite/${invitation.id}`,
    },
  );
  if (inviteError) {
    await supabase.rpc("revoke_organization_invitation", {
      p_invitation_id: invitation.id,
    });
    redirect("/app/team?error=email_failed");
  }
  redirect("/app/team?sent=1");
}

export async function acceptInvitation(invitationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_organization_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) redirect(`/invite/${invitationId}?error=invalid_invitation`);
  redirect("/app");
}
