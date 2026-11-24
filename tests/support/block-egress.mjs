// Preloaded with `node --import` into the server under E2E test. Loopback
// (Next.js itself and local Supabase) stays open; everything else is refused.
import { appendFileSync } from "node:fs";

import { installNetworkGuard } from "./network-guard.mjs";

installNetworkGuard({
  allowLoopback: true,
  onBlocked: (target) => {
    const log = process.env.CAEL_BLOCKED_EGRESS_LOG;
    if (log) appendFileSync(log, `${target}\n`);
  },
});
