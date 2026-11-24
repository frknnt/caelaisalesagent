import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

export const inputClass =
  "border-edge bg-paper w-full rounded-2xl border px-4 py-3 text-base transition-colors duration-200 hover:border-[#aab1bc] focus-visible:border-violet focus-visible:outline-offset-0 aria-invalid:border-rose-ink";

interface FieldShellProps {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  optional?: boolean;
}

function describedBy(id: string, error?: string, hint?: string) {
  const ids = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function FieldLabel({ id, label, optional }: FieldShellProps) {
  return (
    <label htmlFor={id} className="font-medium">
      {label}
      {optional ? (
        <span className="text-body font-normal"> (optional)</span>
      ) : null}
    </label>
  );
}

function FieldNotes({ id, error, hint }: FieldShellProps) {
  return (
    <>
      {hint ? (
        <p id={`${id}-hint`} className="text-body mt-1.5 text-[0.9375rem]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={`${id}-error`}
          className="text-rose-ink mt-1.5 text-[0.9375rem] font-medium"
        >
          {error}
        </p>
      ) : null}
    </>
  );
}

type TextFieldProps = FieldShellProps & Omit<ComponentProps<"input">, "id">;

export function TextField({
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: TextFieldProps) {
  const shell: FieldShellProps = {
    id: props.id,
    label,
    error,
    ...(hint ? { hint } : {}),
    ...(optional ? { optional } : {}),
  };
  return (
    <div>
      <FieldLabel {...shell} />
      <input
        className={cn(inputClass, "mt-2 min-h-13", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(props.id, error, hint)}
        {...props}
      />
      <FieldNotes {...shell} />
    </div>
  );
}

type TextAreaFieldProps = FieldShellProps &
  Omit<ComponentProps<"textarea">, "id">;

export function TextAreaField({
  label,
  error,
  hint,
  optional,
  className,
  ...props
}: TextAreaFieldProps) {
  const shell: FieldShellProps = {
    id: props.id,
    label,
    error,
    ...(hint ? { hint } : {}),
    ...(optional ? { optional } : {}),
  };
  return (
    <div>
      <FieldLabel {...shell} />
      <textarea
        rows={5}
        className={cn(inputClass, "mt-2 min-h-32", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(props.id, error, hint)}
        {...props}
      />
      <FieldNotes {...shell} />
    </div>
  );
}
