import { ArrowUpRight, Globe, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/brand/Logo";
import { CornerDots } from "@/components/ui/CornerDots";
import { Disc } from "@/components/ui/Disc";
import { footerDescription, footerGroups } from "@/data/footer";
import { routes } from "@/data/navigation";

import { PageContainer } from "./PageContainer";

export function Footer() {
  return (
    <footer className="pt-10 pb-10 sm:pb-14">
      <PageContainer>
        <div className="border-line rounded-panel border bg-[#f2f3f6] p-1.5 sm:p-2">
          <div className="flex flex-col gap-6 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-9 sm:py-9">
            <div>
              <h2 className="text-2xl font-medium">Deploy your first agent</h2>
              <p className="text-body mt-2">
                Choose a job, add approved knowledge, and test before you
                publish.{" "}
                <Link
                  href={routes.startFree}
                  className="text-ink inline-flex min-h-11 items-center font-semibold underline decoration-edge decoration-2 underline-offset-4 hover:decoration-ink"
                >
                  Start building free
                </Link>
              </p>
            </div>
            <div className="flex gap-3" aria-hidden="true">
              <Disc size="lg" className="sm:size-[5.5rem]">
                <Globe className="text-cyan-ink size-7 sm:size-8" />
              </Disc>
              <Disc size="lg" className="bg-none! bg-paper! sm:size-[5.5rem]">
                <MessageCircle className="size-7 sm:size-8" />
              </Disc>
              <Disc size="lg" className="sm:size-[5.5rem]">
                <Mail className="text-violet size-7 sm:size-8" />
              </Disc>
            </div>
          </div>

          <div className="rounded-card bg-paper relative grid gap-12 px-6 py-12 sm:px-9 sm:py-16 lg:grid-cols-[1fr_2.2fr] lg:gap-10 xl:grid-cols-[1.25fr_2fr] xl:gap-16">
            <CornerDots />
            <div>
              <Logo size="lg" />
              <p className="text-body mt-5 max-w-sm">{footerDescription}</p>
            </div>
            <div className="grid gap-10 sm:grid-cols-3 sm:gap-8 xl:gap-12">
              {footerGroups.map((group) => (
                <nav key={group.title} aria-label={group.title}>
                  <h3 className="text-lg font-medium">{group.title}</h3>
                  <ul className="divide-line mt-3 divide-y">
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          className="group hover:text-violet-ink flex min-h-12 items-center justify-between gap-3 font-medium transition-colors"
                        >
                          {link.label}
                          <ArrowUpRight
                            aria-hidden="true"
                            className="size-4 text-[#7b828d] transition-[translate] duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              ))}
            </div>
          </div>

          <div className="text-body flex flex-col gap-2 px-5 py-7 text-[0.9375rem] sm:flex-row sm:items-center sm:justify-between sm:px-9">
            <p>© 2026 Cael AI Sales Agent. All rights reserved.</p>
            <p>Product visuals use example data.</p>
          </div>
        </div>
      </PageContainer>
    </footer>
  );
}
