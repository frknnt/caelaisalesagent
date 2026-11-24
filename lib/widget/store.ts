/** What the database decided. Every refusal is the same `denied`. */
export type Refusal =
  { outcome: "denied" } | { outcome: "rate_limited"; retryAfter: number };

export interface WidgetSite {
  siteId: string;
  siteKeyId: string;
  siteName: string;
  widgetTitle: string;
  locale: string;
  accentColor: string;
  handoffUrl: string | null;
}

export interface BootstrapSite extends WidgetSite {
  organizationId: string;
  environment: "production" | "preview";
  position: "bottom-right" | "bottom-left";
}

export type BootstrapResult =
  { outcome: "allowed"; site: BootstrapSite } | Refusal;
export type FrameResult =
  { outcome: "allowed"; site: Omit<WidgetSite, "siteKeyId"> } | Refusal;
export type SessionResult =
  | { outcome: "allowed"; sessionId: string; expiresAt: Date }
  | { outcome: "replayed" }
  | Refusal;
export type SessionCheck =
  | {
      outcome: "allowed";
      organizationId: string;
      siteId: string;
      expiresAt: Date;
    }
  | Refusal;

export interface WidgetStore {
  bootstrap(input: {
    publicKey: string;
    hostname: string;
    clientHash: string | null;
  }): Promise<BootstrapResult>;
  frame(input: {
    siteKeyId: string;
    hostname: string;
    clientHash: string | null;
  }): Promise<FrameResult>;
  createSession(input: {
    siteKeyId: string;
    hostname: string;
    origin: string;
    bootstrapId: string;
    clientHash: string | null;
    ttlSeconds: number;
  }): Promise<SessionResult>;
  checkSession(input: {
    sessionId: string;
    siteKeyId: string;
    origin: string;
    hostname: string;
  }): Promise<SessionCheck>;
}
