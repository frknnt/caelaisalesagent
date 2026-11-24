export class AuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403,
    public readonly code: "AUTHENTICATION_REQUIRED" | "PERMISSION_DENIED",
  ) {
    super(code);
  }
}

export function assertRequestedOrganization(
  requestedId: string | null | undefined,
  authorizedId: string,
) {
  if (requestedId && requestedId !== authorizedId) {
    throw new AuthorizationError(403, "PERMISSION_DENIED");
  }
}
