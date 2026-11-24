import "server-only";

import { notFound, redirect } from "next/navigation";

import {
  AuthorizationError,
  requireAuthorization,
  type AuthorizedContext,
} from "@/lib/auth/guard";
import { isTestHarnessEnabled } from "@/lib/testing/harness-gate";

/** Gate and sign-in check for every harness page and action. */
export async function requireHarness(path: string): Promise<AuthorizedContext> {
  if (!isTestHarnessEnabled(process.env)) notFound();
  try {
    return await requireAuthorization("content:read");
  } catch (error) {
    if (!(error instanceof AuthorizationError)) throw error;
    if (error.status === 401) {
      redirect(`/login?next=${encodeURIComponent(path)}`);
    }
    notFound();
  }
}
