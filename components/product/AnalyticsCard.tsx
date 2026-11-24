const reasons = [
  { label: "Pricing and terms", share: 78, count: 31 },
  { label: "Integrations", share: 60, count: 24 },
  { label: "Rollout time", share: 43, count: 17 },
  { label: "Security review", share: 28, count: 11 },
];

/** Conversation topics for an example week. Example data only. */
export function AnalyticsCard() {
  return (
    <div className="border-line bg-paper shadow-float rounded-[1.75rem] border p-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-display text-lg font-medium">What leads ask about</p>
        <p className="text-body text-sm">Example week</p>
      </div>
      <ul className="mt-5 space-y-4">
        {reasons.map((reason) => (
          <li key={reason.label}>
            <span className="flex justify-between gap-3 text-[0.9375rem]">
              <span className="font-medium">{reason.label}</span>
              <span className="text-body tabular-nums">
                {reason.count} conversations
              </span>
            </span>
            <span className="bg-fog mt-2 block h-2.5 overflow-hidden rounded-full">
              <span
                className="bg-cyan block h-full rounded-full"
                style={{ width: `${reason.share}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
