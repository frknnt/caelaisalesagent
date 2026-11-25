type ServerName = "harness" | "standard";

export const root: string;
export const e2eServers: Record<ServerName, { port: number; distDir: string }>;
export const hostPort: number;
export function hostUrl(name: string): string;
export const widgetTestSecrets: string;
export const widgetTestIpHeader: string;
export const knowledgeWorkerTestToken: string;
export function serverUrl(name: ServerName): string;
export function readLocalSupabase(): {
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
};
export function serverEnvironment(
  name: ServerName,
  supabase: ReturnType<typeof readLocalSupabase>,
): Record<string, string | undefined>;
