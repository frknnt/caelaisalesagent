import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

// npm scripts run at the repository root. Playwright loads this file as
// CommonJS, where import.meta is not available.
export const root = process.cwd();

export const e2eServers = {
  harness: { port: 3210, distDir: ".next-e2e" },
  standard: { port: 3211, distDir: ".next-e2e-standard" },
};

/** Customer websites of the widget tests, on their own origins. */
export const hostPort = 3212;
export const hostUrl = (name) => `http://${name}.localhost:${hostPort}`;

/** Signs widget tokens of the local test servers only. Never deployed. */
export const widgetTestSecrets = `e2e:${createHash("sha256")
  .update("cael widget tokens, local end-to-end tests")
  .digest("base64url")}`;
export const widgetTestIpHeader = "x-real-ip";
export const knowledgeWorkerTestToken = createHash("sha256")
  .update("cael knowledge worker, local end-to-end tests")
  .digest("base64url");

export const serverUrl = (name) => `http://127.0.0.1:${e2eServers[name].port}`;

/** URL and keys of a running local stack. Refuses anything that is not local. */
export function readLocalSupabase() {
  const workdir = process.env.E2E_SUPABASE_WORKDIR;
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, "node_modules/supabase/dist/supabase.js"),
      "status",
      "--output",
      "env",
      ...(workdir ? ["--workdir", workdir] : []),
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, DO_NOT_TRACK: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const values = Object.fromEntries(
    [...(result.stdout ?? "").matchAll(/^([A-Z0-9_]+)="?([^"\r\n]*)"?$/gm)].map(
      ([, key, value]) => [key, value],
    ),
  );
  const { API_URL, PUBLISHABLE_KEY, SECRET_KEY } = values;
  if (result.status !== 0 || !API_URL || !PUBLISHABLE_KEY || !SECRET_KEY) {
    throw new Error(
      "Local Supabase is not running. Start Docker, then run `npm run db:start`.",
    );
  }
  if (!["127.0.0.1", "localhost"].includes(new URL(API_URL).hostname)) {
    throw new Error("E2E tests run against a local Supabase stack only.");
  }
  return {
    NEXT_PUBLIC_SUPABASE_URL: API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY: SECRET_KEY,
  };
}

/** Environment of one build and of the server that runs it. */
export function serverEnvironment(name, supabase) {
  return {
    ...process.env,
    ...supabase,
    APP_BASE_URL: serverUrl(name),
    CAEL_NEXT_DIST_DIR: e2eServers[name].distDir,
    LEAD_INTAKE_WEBHOOK_URL: "",
    NEXT_TELEMETRY_DISABLED: "1",
    WIDGET_CLIENT_IP_HEADER: widgetTestIpHeader,
    WIDGET_TOKEN_SECRETS: widgetTestSecrets,
    INGESTION_WORKER_TOKEN: knowledgeWorkerTestToken,
    INGESTION_MALWARE_SCANNER_URL: "",
    INGESTION_MALWARE_SCANNER_TOKEN: "",
  };
}
