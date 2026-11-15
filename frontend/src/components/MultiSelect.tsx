import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";
import { useAnchoredPopover } from "./useAnchoredPopover";

export type MultiSelectOption = {
  id: number;
  name: string;
  group?: string;
};

export function MultiSelect({
  label,
  placeholder,
  options,
  value,
  onChange
}: {
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  const { open, setOpen, triggerRef, panelRef, panelId, panelProps } = useAnchoredPopover();
  const selected = options.filter((option) => value.includes(option.id));
  const summary = selected.length === 0 ? placeholder : selected.map((option) => option.name).join(", ");

  const toggle = (id: number) => {
    onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  };

  let previousGroup = "";

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        className="control flex w-full items-center justify-between gap-2 text-left"
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={cn("min-w-0 flex-1 truncate", selected.length === 0 && "text-stone-400")}>{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
      </button>
      {open && (
        <div ref={panelRef} {...panelProps}>
          {options.length === 0 ? (
            <p className="px-2 py-3 text-sm text-stone-500 dark:text-stone-400">Nothing to choose</p>
          ) : (
            options.map((option) => {
              const showGroup = option.group && option.group !== previousGroup;
              previousGroup = option.group ?? previousGroup;
              const checked = value.includes(option.id);
              return (
                <div key={option.id}>
                  {showGroup && <p className="px-2 pb-1 pt-2 text-xs font-bold uppercase text-stone-400">{option.group}</p>}
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-900">
                    <input className="sr-only" type="checkbox" checked={checked} onChange={() => toggle(option.id)} />
                    <span className={cn("grid h-5 w-5 place-items-center rounded-md border", checked ? "border-fern bg-fern text-white" : "border-stone-300 dark:border-stone-600")}>
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.name}</span>
                  </label>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
