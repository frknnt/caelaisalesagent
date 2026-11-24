type Env = Readonly<Record<string, string | undefined>>;

function isLoopbackUrl(value: string | undefined) {
  try {
    const { hostname, protocol } = new URL(value ?? "");
    return (
      ["http:", "https:"].includes(protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Second gate of the test harness. The first one is the build: without
 * CAEL_TEST_HARNESS the `.e2e.tsx` files are not routes at all. This one closes
 * a harness build that is pointed at anything but this machine.
 */
export function isTestHarnessEnabled(env: Env) {
  return (
    env.CAEL_TEST_HARNESS === "enabled" &&
    env.VERCEL === undefined &&
    isLoopbackUrl(env.APP_BASE_URL) &&
    isLoopbackUrl(env.NEXT_PUBLIC_SUPABASE_URL)
  );
}
