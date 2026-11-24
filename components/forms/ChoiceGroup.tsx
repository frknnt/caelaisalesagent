import { cn } from "@/lib/cn";

interface Choice {
  id: string;
  label: string;
  detail?: string;
}

interface ChoiceGroupProps {
  name: string;
  legend: string;
  choices: readonly Choice[];
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
  columns?: "pill" | "two" | "three";
}

/** Native radio group styled as selectable tiles. */
export function ChoiceGroup({
  name,
  legend,
  choices,
  value,
  onChange,
  error,
  columns = "two",
}: ChoiceGroupProps) {
  const errorId = `${name}-error`;
  return (
    <fieldset id={name} tabIndex={-1} aria-describedby={error && errorId}>
      <legend className="font-medium">{legend}</legend>
      <div
        className={cn(
          "mt-2.5 gap-2",
          columns === "pill" && "flex flex-wrap",
          columns === "two" && "grid sm:grid-cols-2",
          columns === "three" && "grid sm:grid-cols-3",
        )}
      >
        {choices.map((choice) => (
          <label
            key={choice.id}
            className={cn(
              "border-edge bg-paper has-checked:border-violet has-checked:bg-violet-soft has-focus-visible:outline-violet flex min-h-12 cursor-pointer items-center gap-3 border px-4 py-2.5 transition-colors duration-200 hover:border-[#aab1bc] has-focus-visible:outline-3 has-focus-visible:outline-offset-2",
              columns === "pill" ? "rounded-full" : "rounded-2xl",
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.id}
              checked={value === choice.id}
              onChange={() => onChange(choice.id)}
              className="size-4 shrink-0 outline-none"
            />
            <span className="leading-snug">
              <span className="block text-[0.9375rem] font-medium">
                {choice.label}
              </span>
              {choice.detail ? (
                <span className="text-body block text-sm">{choice.detail}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {error ? (
        <p
          id={errorId}
          className="text-rose-ink mt-1.5 text-[0.9375rem] font-medium"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
