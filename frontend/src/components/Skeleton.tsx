import { cn } from "../lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-stone-200 dark:bg-stone-800", className)} />;
}
