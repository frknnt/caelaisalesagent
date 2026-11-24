/**
 * Messages between the loader on the customer's page and the frame. Both sides
 * also check the sender's window and origin; a message alone proves nothing.
 */
export type FrameMessage =
  | { cael: 1; type: "ready" }
  | { cael: 1; type: "renew" }
  | { cael: 1; type: "close" };

export type HostMessage =
  | { cael: 1; type: "token"; token: string }
  | { cael: 1; type: "failed" }
  | { cael: 1; type: "shown"; modal: boolean };

export function isMessage(
  value: unknown,
): value is Record<string, unknown> & { type: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { cael?: unknown }).cael === 1 &&
    typeof (value as { type?: unknown }).type === "string"
  );
}

/** Black or white, whichever reads better. The better one is always above 4.5:1. */
export function inkOn(hex: string): "#000000" | "#ffffff" {
  const channel = (offset: number) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.1791 ? "#000000" : "#ffffff";
}
