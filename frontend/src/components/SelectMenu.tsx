import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
  onChange
}: {
  label: string;
  placeholder: string;
  options: SelectMenuOption<T>[];
  value: T | "";
  onChange: (id: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.id === value);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        className="control flex w-full items-center justify-between gap-2 text-left"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selected && "text-stone-400")}>{selected?.name ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
      </button>
      {open && (
        <div id={listId} role="listbox" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-200 bg-white p-2 shadow-soft dark:border-stone-700 dark:bg-stone-950">
          {options.length === 0 ? (
            <p className="px-2 py-3 text-sm text-stone-500 dark:text-stone-400">Nothing to choose</p>
          ) : (
            options.map((option) => {
              const checked = option.id === value;
              return (
                <button
                  key={option.id}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-900"
                  type="button"
                  role="option"
                  aria-selected={checked}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                >
                  <span className={cn("grid h-5 w-5 place-items-center rounded-md border", checked ? "border-fern bg-fern text-white" : "border-stone-300 dark:border-stone-600")}>
                    {checked && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{option.name}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
