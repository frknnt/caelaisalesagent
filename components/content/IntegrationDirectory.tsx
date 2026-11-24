"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/Badge";
import { Disc } from "@/components/ui/Disc";
import {
  integrationCategories,
  integrations,
  integrationStatusNotes,
} from "@/data/integrations";
import { cn } from "@/lib/cn";
import type { IntegrationCategory, IntegrationStatus } from "@/types/content";

import { IntegrationGlyph } from "./IntegrationGlyph";

type Filter = IntegrationCategory | "All";

const filters: Filter[] = ["All", ...integrationCategories];

const statusTone: Record<IntegrationStatus, "mint" | "cyan" | "neutral"> = {
  "In development": "mint",
  Planned: "cyan",
  Considering: "neutral",
};

export function IntegrationDirectory() {
  const [filter, setFilter] = useState<Filter>("All");
  const visible = integrations.filter(
    (item) => filter === "All" || item.category === filter,
  );

  return (
    <div>
      <div
        role="group"
        aria-label="Filter integrations by category"
        className="flex flex-wrap justify-center gap-2"
      >
        {filters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => setFilter(item)}
            className={cn(
              "min-h-12 rounded-full border px-5 text-[0.9375rem] font-semibold transition-colors duration-200",
              filter === item
                ? "border-ink bg-ink text-paper"
                : "border-line bg-paper hover:bg-mist hover:border-edge",
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <p role="status" className="text-body mt-5 text-center">
        Showing {visible.length} of {integrations.length}
      </p>
      <ul className="mt-6 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((item) => (
          <li
            key={item.name}
            className="card-lift rounded-card border-line flex flex-col border bg-linear-to-b from-[#f6f7f9] to-white p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <Disc>
                <IntegrationGlyph category={item.category} className="size-6" />
              </Disc>
              <Badge tone={statusTone[item.status]}>{item.status}</Badge>
            </div>
            <h3 className="mt-5 text-xl font-medium">{item.name}</h3>
            <p className="text-body mt-1.5">{item.description}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-8 flex flex-col justify-center gap-x-8 gap-y-3 sm:flex-row sm:flex-wrap">
        {(
          Object.entries(integrationStatusNotes) as [
            IntegrationStatus,
            string,
          ][]
        )
          .filter(([status]) =>
            integrations.some((item) => item.status === status),
          )
          .map(([status, note]) => (
            <div key={status} className="flex flex-wrap items-center gap-2.5">
              <dt>
                <Badge tone={statusTone[status]}>{status}</Badge>
              </dt>
              <dd className="text-body text-[0.9375rem]">{note}</dd>
            </div>
          ))}
      </dl>
    </div>
  );
}
