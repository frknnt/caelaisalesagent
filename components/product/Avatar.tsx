import { cn } from "@/lib/cn";

type AvatarTone = "slate" | "cyan" | "amber" | "violet";

const tones: Record<AvatarTone, string> = {
  slate: "bg-[#6d7391] text-white",
  cyan: "bg-cyan-ink text-white",
  amber: "bg-[#ffd48a] text-[#5b2c06]",
  violet: "bg-violet text-white",
};

interface AvatarProps {
  initials: string;
  tone?: AvatarTone;
  className?: string;
}

export function Avatar({ initials, tone = "slate", className }: AvatarProps) {
  return (
    <span
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
        tones[tone],
        className,
      )}
    >
      {initials}
    </span>
  );
}
