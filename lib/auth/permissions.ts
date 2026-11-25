export const roles = ["owner", "admin", "editor", "sales", "viewer"] as const;
export type OrganizationRole = (typeof roles)[number];

export const permissions = {
  owner: [
    "organization:update",
    "members:manage",
    "invitations:manage",
    "content:write",
    "content:read",
    "knowledge:manage",
  ],
  admin: [
    "organization:update",
    "members:manage",
    "invitations:manage",
    "content:write",
    "content:read",
    "knowledge:manage",
  ],
  editor: ["content:write", "content:read", "knowledge:manage"],
  sales: ["content:read"],
  viewer: ["content:read"],
} as const satisfies Record<OrganizationRole, readonly string[]>;

export type Permission = (typeof permissions)[OrganizationRole][number];

export function hasPermission(role: OrganizationRole, permission: Permission) {
  return (permissions[role] as readonly string[]).includes(permission);
}
