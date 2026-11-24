import type { NextConfig } from "next";

// Isolated build output, so an E2E or check build never replaces the `.next`
// of a running dev server.
const distDir = process.env.CAEL_NEXT_DIST_DIR || ".next";
if (!/^\.next(?:-[a-z0-9]+)*$/.test(distDir)) {
  throw new Error("CAEL_NEXT_DIST_DIR must look like .next or .next-name");
}

// Files ending in `.e2e.tsx` are routes only in a test harness build. In every
// other build they do not exist, so there is nothing to switch on at run time.
const isHarnessBuild = process.env.CAEL_TEST_HARNESS === "enabled";

// Nothing may frame this application. The widget frame sets its own policy: it
// names the one customer origin its signed ticket was issued for.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value:
      "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  agentRules: false,
  distDir,
  async headers() {
    return [
      { source: "/:path((?!widget/v1/frame$).*)", headers: securityHeaders },
    ];
  },
  experimental: {
    cpus: 1,
    webpackBuildWorker: false,
  },
  pageExtensions: isHarnessBuild ? ["e2e.tsx", "tsx", "ts"] : ["tsx", "ts"],
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    root: process.cwd(),
  },
  ...(distDir === ".next"
    ? {}
    : { typescript: { tsconfigPath: "tsconfig.isolated.json" } }),
};

export default nextConfig;
