import { cn } from "../lib/utils";

export function DateField({
  label = "Date",
  value,
  onChange,
  className
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      className={cn("control w-full", className)}
      type="date"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function MonthField({
  label = "Month",
  value,
  onChange,
  className,
  plain = false
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  plain?: boolean;
}) {
  return (
    <input
      className={cn(plain ? "h-11 w-[9.5rem] bg-transparent px-2 text-center text-sm outline-none" : "control", className)}
      type="month"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
