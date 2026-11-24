import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { AuthorizationError } from "./authorization";
import {
  hasPermission,
  type OrganizationRole,
  type Permission,
} from "./permissions";

export const ACTIVE_ORGANIZATION_COOKIE = "cael-active-organization";

export type MembershipContext = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: OrganizationRole;
};

type AuthorizationContext = Awaited<ReturnType<typeof getAuthorizationContext>>;
export type AuthorizedContext = Omit<
  AuthorizationContext,
  "activeMembership"
> & {
  activeMembership: MembershipContext;
};

export {
  AuthorizationError,
  assertRequestedOrganization,
} from "./authorization";

export async function getAuthorizationContext() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user)
    throw new AuthorizationError(401, "AUTHENTICATION_REQUIRED");

  const { data, error } = await supabase.rpc("get_authorization_context");
  if (error) throw new AuthorizationError(401, "AUTHENTICATION_REQUIRED");
  const memberships = (data ?? []) as MembershipContext[];
  const selectedId = (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const activeMembership =
    memberships.find((item) => item.organization_id === selectedId) ??
    memberships[0] ??
    null;
  return { user: userData.user, memberships, activeMembership };
}

export async function requireAuthorization(
  permission?: Permission,
): Promise<AuthorizedContext> {
  const context = await getAuthorizationContext();
  if (!context.activeMembership)
    throw new AuthorizationError(403, "PERMISSION_DENIED");
  if (permission && !hasPermission(context.activeMembership.role, permission)) {
    throw new AuthorizationError(403, "PERMISSION_DENIED");
  }
  return { ...context, activeMembership: context.activeMembership };
}
