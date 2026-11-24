"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/Button";

interface SubmitButtonProps {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
  className?: string;
}

export function SubmitButton({
  label,
  pendingLabel,
  disabled = false,
  className = "",
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="lg"
      disabled={disabled || pending}
      className={className}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
