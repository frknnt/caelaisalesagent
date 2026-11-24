import type { BootstrapSite, Refusal, WidgetStore } from "@/lib/widget/store";

export const fixtureSite: BootstrapSite = {
  organizationId: "a0000000-0000-4000-8000-000000000001",
  siteId: "a0000000-0000-4000-8000-000000000101",
  siteKeyId: "a0000000-0000-4000-8000-000000000301",
  environment: "production",
  siteName: "Tenant A Main",
  widgetTitle: "Tenant A satış asistanı",
  locale: "tr-TR",
  accentColor: "#0b7188",
  position: "bottom-right",
  handoffUrl: "https://shop-a.example/contact",
};

export const fixturePublicKey = "cael_pk_a0000000000000000000000000000001";

interface FakeWidgetStoreOptions {
  hostnames?: readonly string[];
  now: () => Date;
}

/**
 * One site, one key and a list of allowed hosts. The real policy is SQL and is
 * tested in supabase/tests; this shows what the handlers do with its answers.
 */
export function createFakeWidgetStore({
  hostnames = ["shop-a.example"],
  now,
}: FakeWidgetStoreOptions) {
  const allowed = new Set(hostnames);
  const usedBootstraps = new Set<string>();
  const sessions = new Map<
    string,
    { siteKeyId: string; origin: string; expiresAt: Date }
  >();
  const calls: { method: string; input: Record<string, unknown> }[] = [];
  let forced: Refusal | null = null;
  let failure: Error | null = null;

  const begin = (method: string, input: object) => {
    calls.push({ method, input: { ...input } });
    if (failure) throw failure;
    return forced;
  };
  const isAllowed = (siteKeyId: string, hostname: string) =>
    siteKeyId === fixtureSite.siteKeyId && allowed.has(hostname);

  const store: WidgetStore = {
    async bootstrap(input) {
      const refusal = begin("bootstrap", input);
      if (refusal) return refusal;
      return input.publicKey === fixturePublicKey && allowed.has(input.hostname)
        ? { outcome: "allowed", site: fixtureSite }
        : { outcome: "denied" };
    },
    async frame(input) {
      const refusal = begin("frame", input);
      if (refusal) return refusal;
      return isAllowed(input.siteKeyId, input.hostname)
        ? { outcome: "allowed", site: fixtureSite }
        : { outcome: "denied" };
    },
    async createSession(input) {
      const refusal = begin("createSession", input);
      if (refusal) return refusal;
      if (!isAllowed(input.siteKeyId, input.hostname)) {
        return { outcome: "denied" };
      }
      if (usedBootstraps.has(input.bootstrapId)) return { outcome: "replayed" };
      usedBootstraps.add(input.bootstrapId);
      const sessionId = `f0000000-0000-4000-8000-${String(sessions.size + 1).padStart(12, "0")}`;
      const expiresAt = new Date(now().getTime() + input.ttlSeconds * 1000);
      sessions.set(sessionId, {
        siteKeyId: input.siteKeyId,
        origin: input.origin,
        expiresAt,
      });
      return { outcome: "allowed", sessionId, expiresAt };
    },
    async checkSession(input) {
      const refusal = begin("checkSession", input);
      if (refusal) return refusal;
      const session = sessions.get(input.sessionId);
      return session &&
        session.siteKeyId === input.siteKeyId &&
        session.origin === input.origin &&
        isAllowed(input.siteKeyId, input.hostname) &&
        session.expiresAt > now()
        ? {
            outcome: "allowed",
            organizationId: fixtureSite.organizationId,
            siteId: fixtureSite.siteId,
            expiresAt: session.expiresAt,
          }
        : { outcome: "denied" };
    },
  };

  return {
    store,
    calls,
    sessions,
    allowed,
    force: (refusal: Refusal | null) => {
      forced = refusal;
    },
    fail: (error: Error | null) => {
      failure = error;
    },
  };
}
