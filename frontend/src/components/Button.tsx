import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-fern text-white shadow-soft hover:bg-fern/90",
        variant === "secondary" && "border border-stone-200 bg-white text-ink hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50",
        variant === "ghost" && "text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800",
        className
      )}
      {...props}
    />
  );
}
