import type { NavItem } from "@/types/site";

export const primaryNavigation: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Integrations", href: "/integrations" },
  { label: "Resources", href: "/resources" },
  { label: "Blog", href: "/blog" },
];

export const routes = {
  startFree: "/start-free",
  bookDemo: "/contact?topic=demo",
  signIn: "/login",
  documentation: "/resources/documentation",
} as const;

/** Exact match for home, prefix match for everything else. */
export function isActiveRoute(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
