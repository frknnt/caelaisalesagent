"use client";

import { Check } from "lucide-react";
import { useState } from "react";

import { ButtonLink } from "@/components/ui/Button";
import { CornerDots } from "@/components/ui/CornerDots";
import { pricingPlans, teamShapes } from "@/data/pricing";
import { cn } from "@/lib/cn";

/** Pick the shape of your team to highlight the plan that fits. */
export function PlanExplorer() {
  const [selected, setSelected] = useState<string>("team");

  return (
    <div>
      <fieldset className="mx-auto w-fit max-w-full text-center">
        <legend className="mx-auto mb-3 font-medium">Who will use Cael?</legend>
        <div className="border-line flex flex-col rounded-[1.75rem] border bg-[#ebedf1] p-1 sm:flex-row sm:rounded-full">
          {teamShapes.map((shape) => (
            <label
              key={shape.id}
              className="has-checked:bg-paper has-checked:text-ink has-focus-visible:outline-violet flex min-h-12 cursor-pointer items-center justify-center rounded-full px-7 text-[0.9375rem] font-semibold text-[#555b66] transition-colors duration-200 has-focus-visible:outline-3"
            >
              <input
                type="radio"
                name="team-shape"
                value={shape.id}
                checked={selected === shape.id}
                onChange={() => setSelected(shape.id)}
                className="sr-only"
              />
              {shape.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="panel-surface rounded-panel mt-9 grid gap-1.5 p-1.5 sm:gap-2 sm:p-2 lg:grid-cols-3">
        {pricingPlans.map((plan) => {
          const active = plan.id === selected;
          return (
            <section
              key={plan.id}
              aria-labelledby={`plan-${plan.id}`}
              className={cn(
                "rounded-card relative flex flex-col p-7 transition-shadow duration-200 sm:p-9",
                active
                  ? "gradient-border shadow-card"
                  : "border-line bg-paper border-2",
              )}
            >
              <CornerDots />
              <div className="flex min-h-8 items-center justify-between gap-3">
                <h2
                  id={`plan-${plan.id}`}
                  className="text-2xl leading-none font-medium"
                >
                  {plan.name}
                </h2>
                {active ? (
                  <span className="bg-violet-soft text-violet-ink rounded-full px-3 py-1 text-sm font-semibold">
                    Fits your answer
                  </span>
                ) : null}
              </div>
              <p className="text-body mt-1.5">{plan.audience}</p>
              <p className="font-display mt-8 text-4xl leading-tight font-medium">
                {plan.price}
              </p>
              <p className="text-body mt-1 text-[0.9375rem]">
                {plan.priceNote}
              </p>
              <p className="mt-6">{plan.description}</p>
              <ul className="mt-5 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-3 leading-snug">
                    <Check
                      className="text-mint-ink mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-9">
                <ButtonLink
                  href={plan.cta.href}
                  variant={active ? "primary" : "soft"}
                  size="lg"
                  className="w-full"
                >
                  {plan.cta.label}
                </ButtonLink>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
