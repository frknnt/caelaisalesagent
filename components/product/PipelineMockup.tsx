import { Badge } from "@/components/ui/Badge";

import { Avatar } from "./Avatar";

const stages = [
  {
    name: "New",
    deals: [
      { company: "Orrin Labs", owner: "Agent", next: "Asked about pricing" },
      { company: "Tavo Retail", owner: "Agent", next: "First reply sent" },
    ],
  },
  {
    name: "Qualified",
    deals: [
      { company: "Halden Studio", owner: "JO", next: "Call Thu, 2:00 PM" },
    ],
  },
  {
    name: "With a rep",
    deals: [
      { company: "Brightwell", owner: "AK", next: "Security review" },
      { company: "Mara & Finch", owner: "JO", next: "Custom terms" },
    ],
  },
];

export function PipelineMockup() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stages.map((stage) => (
        <div key={stage.name} className="rounded-[1.5rem] bg-[#eaecf0] p-2">
          <p className="flex items-center justify-between px-3 py-2 font-medium">
            {stage.name}
            <span className="text-body text-sm tabular-nums">
              {stage.deals.length}
            </span>
          </p>
          <div className="space-y-2">
            {stage.deals.map((deal) => (
              <div
                key={deal.company}
                className="bg-paper shadow-card rounded-[1.1rem] p-4"
              >
                <p className="font-semibold">{deal.company}</p>
                <p className="text-body mt-0.5 text-sm">{deal.next}</p>
                <span className="mt-3 flex items-center gap-2">
                  {deal.owner === "Agent" ? (
                    <Badge tone="cyan">AI agent</Badge>
                  ) : (
                    <>
                      <Avatar
                        initials={deal.owner}
                        tone={deal.owner === "JO" ? "amber" : "violet"}
                        className="size-8"
                      />
                      <span className="text-body text-sm">Rep owns it</span>
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
