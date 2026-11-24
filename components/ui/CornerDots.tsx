import { cn } from "@/lib/cn";

const positions = [
  "top-5 left-5",
  "top-5 right-5",
  "bottom-5 left-5",
  "bottom-5 right-5",
];

export function CornerDots({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      {positions.map((position) => (
        <span
          key={position}
          className={cn("bg-edge absolute size-1 rounded-full", position)}
        />
      ))}
    </span>
  );
}
