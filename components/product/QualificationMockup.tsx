import { Check, Minus } from "lucide-react";

import { Badge } from "@/components/ui/Badge";

const criteria = [
  { label: "Fit", value: "B2B services, 40 reps", met: true, points: 30 },
  { label: "Need", value: "Slow first replies", met: true, points: 26 },
  { label: "Timing", value: "This quarter", met: true, points: 30 },
  { label: "Budget", value: "Not discussed", met: false, points: 0 },
];

/** Lead score built from explicit criteria. 30 + 26 + 30 + 0 = 86. */
export function QualificationMockup() {
  return (
    <div className="border-line bg-paper shadow-float rounded-[1.75rem] border p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-body text-sm">Lead score</p>
          <p className="font-display text-4xl leading-tight font-semibold tabular-nums">
            86
          </p>
        </div>
        <Badge tone="violet">Above your threshold</Badge>
      </div>
      <ul className="divide-line mt-4 divide-y">
        {criteria.map((item) => (
          <li key={item.label} className="flex items-center gap-3 py-3.5">
            <span
              className={
                item.met
                  ? "bg-mint-soft text-mint-ink inline-flex size-8 items-center justify-center rounded-full"
                  : "bg-fog text-body inline-flex size-8 items-center justify-center rounded-full"
              }
            >
              {item.met ? (
                <Check className="size-4" strokeWidth={2.6} />
              ) : (
                <Minus className="size-4" strokeWidth={2.6} />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{item.label}</span>
              <span className="text-body block text-sm">{item.value}</span>
            </span>
            <span className="font-semibold tabular-nums">+{item.points}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
