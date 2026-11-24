import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "outline" | "soft" | "quiet";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2.5 rounded-full text-center font-semibold whitespace-nowrap transition-[background-color,box-shadow,color,translate] duration-200 ease-out-soft active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-paper shadow-button hover:bg-[#2a2c33]",
  outline: "gradient-border text-ink hover:text-violet-ink",
  soft: "border border-line bg-paper text-ink hover:border-edge hover:bg-mist",
  quiet:
    "text-ink underline-offset-4 decoration-2 decoration-edge hover:underline",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-6 text-[0.9375rem]",
  lg: "min-h-14 px-8 text-base sm:min-w-52",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
  className?: string;
}

function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: StyleProps) {
  return cn(
    base,
    variants[variant],
    variant === "quiet" ? "min-h-12 px-3 text-base" : sizes[size],
    className,
  );
}

interface ButtonLinkProps extends StyleProps {
  href: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, className })}>
      {children}
    </Link>
  );
}

type ButtonProps = Omit<ComponentProps<"button">, "className"> & StyleProps;

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      {...props}
    />
  );
}
