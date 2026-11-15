import { cn } from "../lib/utils";

export type SelectMenuOption<T extends number | string = number> = {
  id: T;
  name: string;
};

export function SelectMenu<T extends number | string = number>({
  label,
  placeholder,
  options,
  value,
  onChange,
  className
}: {
  label: string;
  placeholder: string;
  options: SelectMenuOption<T>[];
  value: T | "";
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <select
      className={cn("control w-full", className)}
      aria-label={label}
      value={value === "" ? "" : String(value)}
      onChange={(event) => {
        const next = event.target.value;
        if (next === "") return;
        const match = options.find((option) => String(option.id) === next);
        if (match) onChange(match.id);
      }}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((option) => (
        <option key={String(option.id)} value={String(option.id)}>
          {option.name}
        </option>
      ))}
    </select>
  );
}
