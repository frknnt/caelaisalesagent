export type RuntimeConfigResult =
  | { ok: true; value: { appBaseUrl: string } }
  | {
      ok: false;
      status: 503;
      error: {
        code: "APP_BASE_URL_MISSING" | "APP_BASE_URL_INVALID";
        message: string;
      };
    };

const productionError = (
  code: "APP_BASE_URL_MISSING" | "APP_BASE_URL_INVALID",
  message: string,
): RuntimeConfigResult => ({
  ok: false,
  status: 503,
  error: { code, message },
});

export function readRuntimeConfig(
  env: Readonly<Record<string, string | undefined>>,
  mode: "development" | "test" | "production",
): RuntimeConfigResult {
  const rawUrl = env.APP_BASE_URL?.trim();

  if (!rawUrl) {
    if (mode !== "production") {
      return { ok: true, value: { appBaseUrl: "http://localhost:3000" } };
    }

    return productionError(
      "APP_BASE_URL_MISSING",
      "Uygulama yapılandırması eksik. Lütfen sistem yöneticisine başvurun.",
    );
  }

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return productionError(
        "APP_BASE_URL_INVALID",
        "Uygulama adresi geçersiz. Lütfen sistem yöneticisine başvurun.",
      );
    }

    return { ok: true, value: { appBaseUrl: parsed.origin } };
  } catch {
    return productionError(
      "APP_BASE_URL_INVALID",
      "Uygulama adresi geçersiz. Lütfen sistem yöneticisine başvurun.",
    );
  }
}

export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

export function readSupabasePublicConfig(
  env: Readonly<Record<string, string | undefined>>,
): SupabasePublicConfig | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return { url: parsed.origin, publishableKey };
  } catch {
    return null;
  }
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = readSupabasePublicConfig(process.env);
  if (!config) throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  return config;
}

export function requireSupabaseSecretKey(): string {
  const value = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!value) throw new Error("SUPABASE_SECRET_KEY_MISSING");
  return value;
}

/** Server-only delivery endpoint for contact and start-free requests. */
export function readLeadIntakeUrl(
  env: Readonly<Record<string, string | undefined>>,
): string | null {
  const raw = env.LEAD_INTAKE_WEBHOOK_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const isLocal = ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol === "https:") return parsed.toString();
    return parsed.protocol === "http:" && isLocal ? parsed.toString() : null;
  } catch {
    return null;
  }
}
