export function isFreshSource(
  status: string,
  freshUntil: string | null,
  now = Date.now(),
) {
  return (
    status === "ready" &&
    Boolean(freshUntil) &&
    new Date(freshUntil ?? 0).getTime() > now
  );
}
