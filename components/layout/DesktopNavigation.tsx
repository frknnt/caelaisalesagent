"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isActiveRoute, primaryNavigation } from "@/data/navigation";
import { cn } from "@/lib/cn";

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="border-line flex items-center gap-0.5 rounded-full border bg-[#ebedf1] p-1">
        {primaryNavigation.map((item) => {
          const active = isActiveRoute(pathname, item.href);
          return (
            <li key={item.href} className="relative">
              {active ? (
                <span
                  aria-hidden="true"
                  className="bg-amber absolute -top-[0.4375rem] left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-full"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 items-center rounded-full px-3.5 text-[0.9375rem] transition-colors duration-200 xl:px-5",
                  active
                    ? "bg-paper text-ink font-semibold"
                    : "hover:text-ink font-medium text-[#555b66] hover:bg-white/60",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
