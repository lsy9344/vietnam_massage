import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "bg-brand text-brand-foreground hover:bg-brand-strong",
  secondary: "border border-border text-foreground hover:bg-readonly",
  ghost: "text-muted hover:bg-readonly hover:text-foreground"
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants;
}

export function Button({
  className,
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-secondary disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      type={type}
      {...props}
    />
  );
}
