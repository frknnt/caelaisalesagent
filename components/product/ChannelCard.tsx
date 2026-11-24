import type { LucideIcon } from "lucide-react";

import { Disc } from "@/components/ui/Disc";

interface ChannelCardProps {
  icon: LucideIcon;
  name: string;
  detail: string;
}

export function ChannelCard({ icon: Icon, name, detail }: ChannelCardProps) {
  return (
    <div className="border-line bg-paper shadow-card flex items-center gap-3 rounded-full border py-2 pr-6 pl-2">
      <Disc size="sm">
        <Icon className="size-5" strokeWidth={1.9} />
      </Disc>
      <span className="leading-tight">
        <span className="block text-[0.9375rem] font-semibold">{name}</span>
        <span className="text-body block text-sm">{detail}</span>
      </span>
    </div>
  );
}
