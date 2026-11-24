import { Check, Minus, Wallet } from "lucide-react";
import Link from "next/link";

import { PlanExplorer } from "@/components/content/PlanExplorer";
import { FaqSection } from "@/components/home/FaqSection";
import { FinalCta } from "@/components/home/FinalCta";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHero } from "@/components/layout/PageHero";
import { Section } from "@/components/layout/Section";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pricingFaq } from "@/data/faq";
import { pricingPlans, pricingRows } from "@/data/pricing";
import { pageMetadata } from "@/lib/site/metadata";

export const metadata = pageMetadata({
  title: "Pricing",
  description:
    "Build your first agent free. Team and Scale plans are quoted by agents, channels, and conversations.",
  path: "/pricing",
});

function CellValue({ value }: { value: string }) {
  if (value === "Included")
    return (
      <span className="inline-flex items-center gap-2 font-medium">
        <Check className="text-mint-ink size-5" aria-hidden="true" />
        Included
      </span>
    );
  if (value === "Not included")
    return (
      <span className="text-body inline-flex items-center gap-2">
        <Minus className="size-5" aria-hidden="true" />
        Not included
      </span>
    );
  return <span className="font-medium">{value}</span>;
}

export default function PricingPage() {
  return (
    <>
      <PageHero
        before="Start Free."
        icon={Wallet}
        after="Grow When Ready."
        description="Build and test without a card. When you are ready to publish, we quote by agents, channels, and monthly conversations."
      />

      <PageContainer className="pb-10">
        <PlanExplorer />
        <p className="text-body mx-auto mt-6 max-w-2xl text-center text-[0.9375rem]">
          Cael is in early access and some plan features are still being built.
          The{" "}
          <Link
            href="/resources/documentation"
            className="text-ink font-medium underline underline-offset-2"
          >
            documentation
          </Link>{" "}
          lists what is available today.
        </p>
      </PageContainer>

      <Section labelledBy="compare-heading">
        <SectionHeading id="compare-heading" before="Compare plans" />
        <div className="rounded-panel border-line mt-9 hidden overflow-hidden border md:block">
          <table className="w-full text-left">
            <caption className="sr-only">
              What each plan includes: Build, Team, and Scale
            </caption>
            <thead className="bg-fog">
              <tr>
                <td className="w-[34%] px-8 py-5" />
                {pricingPlans.map((plan) => (
                  <th
                    key={plan.id}
                    scope="col"
                    className="font-display px-6 py-5 text-lg font-medium"
                  >
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {pricingRows.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-8 py-5 font-medium">
                    {row.label}
                  </th>
                  {pricingPlans.map((plan) => (
                    <td key={plan.id} className="px-6 py-5">
                      <CellValue
                        value={row.values[plan.id] ?? "Not included"}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 space-y-3 md:hidden">
          {pricingRows.map((row) => (
            <section
              key={row.label}
              className="rounded-card border-line border p-5"
            >
              <h3 className="text-lg font-medium">{row.label}</h3>
              <dl className="divide-line mt-2 divide-y">
                {pricingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between gap-4 py-2.5"
                  >
                    <dt className="text-body">{plan.name}</dt>
                    <dd className="text-right">
                      <CellValue
                        value={row.values[plan.id] ?? "Not included"}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </Section>

      <FaqSection
        items={pricingFaq}
        defaultOpen="why-no-prices"
        description="How quotes, usage, and limits work."
      />
      <FinalCta
        title="Build the Agent Before You Budget for It"
        description="Set up one agent, test it with real questions, and decide from what you see."
      />
    </>
  );
}
