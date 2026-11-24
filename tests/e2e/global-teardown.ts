import { existsSync, readFileSync } from "node:fs";

/** Fails the run if a server tried to reach anything outside this machine. */
export default function globalTeardown() {
  const log = "test-results/server/blocked-egress.log";
  if (!existsSync(log)) return;
  throw new Error(
    `Blocked outbound connections:\n${readFileSync(log, "utf8")}`,
  );
}
