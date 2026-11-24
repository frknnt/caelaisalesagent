import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SubmitButton } from "@/components/forms/SubmitButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { Panel } from "@/components/ui/Panel";
import { logout } from "@/lib/auth/actions";
import {
  AuthorizationError,
  requireAuthorization,
  type AuthorizedContext,
} from "@/lib/auth/guard";
import { readSupabasePublicConfig } from "@/lib/env";

export const metadata: Metadata = {
  title: "Workspace",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function loadContext(): Promise<AuthorizedContext | null> {
  if (!readSupabasePublicConfig(process.env)) redirect("/login");
  try {
    return await requireAuthorization();
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    if (error.status === 401) redirect("/login?next=/app");
    return null;
  }
}

/** Landing point after sign-in. The product interface is a separate task. */
export default async function WorkspacePage() {
  const context = await loadContext();
  const membership = context?.activeMembership;

  return (
    <PageContainer width="text" className="pt-8 pb-16 sm:pt-12">
      <Panel>
        <div className="rounded-card border-line bg-paper border p-7 sm:p-12">
          <h1 className="display-md font-normal">
            {membership ? membership.organization_name : "No workspace yet"}
          </h1>
          <p className="text-body mt-3 text-[1.0625rem]">
            {membership
              ? `You are signed in as ${membership.role}. The workspace interface is in development.`
              : "Your account is not a member of a workspace. Ask an owner or admin for an invitation."}
          </p>
          <form action={logout} className="mt-8">
            <SubmitButton label="Sign Out" pendingLabel="Signing out…" />
          </form>
        </div>
      </Panel>
    </PageContainer>
  );
}
