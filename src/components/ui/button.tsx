import * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  default: "bg-brand text-white hover:bg-brand-strong",
  secondary: "bg-readonly text-foreground hover:bg-border",
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
        "inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50",
        buttonVariants[variant],
        className
      )}
      type={type}
      {...props}
    />
  );
}
