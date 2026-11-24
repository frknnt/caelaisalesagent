import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/brand/Logo";
import { TextField } from "@/components/forms/Field";
import { SubmitButton } from "@/components/forms/SubmitButton";
import { PageContainer } from "@/components/layout/PageContainer";
import { Panel } from "@/components/ui/Panel";
import { routes } from "@/data/navigation";
import { login } from "@/lib/auth/actions";
import { readSupabasePublicConfig } from "@/lib/env";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Sign In",
  description: "Sign in to your Cael AI Sales Agent workspace.",
  path: "/login",
  noIndex: true,
});

interface LoginPageProps {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
}

const errorMessages: Record<string, string> = {
  invalid_credentials:
    "That email and password do not match. Check both and try again.",
  callback:
    "That sign-in link is no longer valid. Ask for a new one, or sign in below.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const configured = readSupabasePublicConfig(process.env) !== null;
  const message = !configured
    ? "Sign-in is not connected in this environment yet."
    : typeof error === "string"
      ? errorMessages[error]
      : undefined;

  return (
    <PageContainer className="pt-8 pb-14 sm:pt-12">
      <Panel className="mx-auto max-w-[68rem]">
        <div className="grid lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-12 px-5 py-9 sm:px-10 sm:py-12">
            <LogoMark className="size-14" />
            <div>
              <h1 className="display-lg font-normal">Welcome back</h1>
              <p className="mt-4 max-w-sm text-[1.0625rem] text-[#454b55]">
                Pick up the conversations that need you, with the context
                already written.
              </p>
            </div>
          </div>
          <div className="rounded-card border-line bg-paper border p-6 sm:p-10">
            <form action={login} className="space-y-5">
              {typeof next === "string" ? (
                <input type="hidden" name="next" value={next} />
              ) : null}
              {message ? (
                <p
                  role="alert"
                  className="bg-rose-soft flex gap-3 rounded-2xl p-4 leading-snug"
                >
                  <TriangleAlert
                    className="text-rose-ink mt-0.5 size-5 shrink-0"
                    aria-hidden="true"
                  />
                  {message}
                </p>
              ) : null}
              <TextField
                id="email"
                name="email"
                type="email"
                label="Work email"
                autoComplete="username"
                required
              />
              <TextField
                id="password"
                name="password"
                type="password"
                label="Password"
                autoComplete="current-password"
                required
              />
              <SubmitButton
                label="Sign In"
                pendingLabel="Signing in…"
                disabled={!configured}
                className="w-full"
              />
            </form>
            <div className="border-line mt-8 space-y-1 border-t pt-6">
              <p className="text-body">
                New to Cael?{" "}
                <Link
                  href={routes.startFree}
                  className="text-ink inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                >
                  Start free
                </Link>
              </p>
              <p className="text-body">
                Trouble signing in?{" "}
                <Link
                  href="/support"
                  className="text-ink inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
                >
                  Visit support
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Panel>
    </PageContainer>
  );
}
