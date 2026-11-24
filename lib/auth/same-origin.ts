import { AuthorizationError } from "./authorization";

/** Cookie-authenticated writes must come from a page of this application. */
export function assertSameOrigin(
  headers: Pick<Headers, "get">,
  appOrigin: string,
) {
  const site = headers.get("sec-fetch-site");
  if (
    headers.get("origin") !== appOrigin ||
    (site !== null && site !== "same-origin")
  ) {
    throw new AuthorizationError(403, "PERMISSION_DENIED");
  }
}
