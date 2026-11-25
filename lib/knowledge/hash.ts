import { createHash } from "node:crypto";

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalSourceKey(value: string) {
  return sha256(value.trim().toLowerCase());
}
