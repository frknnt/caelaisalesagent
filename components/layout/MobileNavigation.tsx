"use client";

import { ChevronRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { isActiveRoute, primaryNavigation, routes } from "@/data/navigation";
import { cn } from "@/lib/cn";

/**
 * Uses a native modal dialog: Escape closes it, focus moves inside, and focus
 * returns to the menu button when it closes.
 */
export function MobileNavigation() {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const dialogId = useId();

  const show = () => {
    dialogRef.current?.showModal();
    setOpen(true);
  };
  const close = () => dialogRef.current?.close();

  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  useEffect(() => {
    // The menu is only for small screens; close it if the window grows.
    const query = window.matchMedia("(min-width: 64rem)");
    const onChange = () => {
      if (query.matches) dialogRef.current?.close();
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label="Open menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={show}
        className="border-line bg-mist inline-flex size-12 items-center justify-center rounded-full border"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        className="bg-paper m-0 h-dvh max-h-none w-full max-w-none overscroll-contain"
      >
        <div className="flex min-h-full flex-col px-[1.125rem] pb-8 sm:px-7">
          <div className="flex h-20 items-center justify-between">
            <span onClick={close}>
              <Logo />
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={close}
              className="bg-ink text-paper inline-flex size-12 items-center justify-center rounded-full"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Mobile" className="mt-4">
            <ul className="space-y-2">
              {primaryNavigation.map((item) => {
                const active = isActiveRoute(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      onClick={close}
                      className={cn(
                        "flex min-h-14 items-center justify-between rounded-2xl px-5 text-lg font-medium",
                        active ? "bg-fog" : "bg-mist",
                      )}
                    >
                      <span className="flex items-center gap-3">
                        {active ? (
                          <span
                            aria-hidden="true"
                            className="bg-amber h-5 w-1 rounded-full"
                          />
                        ) : null}
                        {item.label}
                      </span>
                      <ChevronRight
                        className="size-5 text-[#6b7280]"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div
            className="mt-auto grid gap-3 pt-10 sm:grid-cols-2"
            onClick={close}
          >
            <ButtonLink href={routes.startFree} size="lg">
              Start Free
            </ButtonLink>
            <ButtonLink href={routes.signIn} variant="outline" size="lg">
              Sign In
            </ButtonLink>
          </div>
        </div>
      </dialog>
    </div>
  );
}
