import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

export function TagInput({
  value,
  onChange,
  placeholder = "Add tag"
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const suggestions = useQuery({
    queryKey: ["tags", input],
    queryFn: () => api.tags(input),
    enabled: input.trim().length > 0
  });

  const availableSuggestions = useMemo(() => {
    const selected = new Set(value.map((tag) => tag.toLowerCase()));
    return (suggestions.data ?? []).filter((tag) => !selected.has(tag.name.toLowerCase())).slice(0, 6);
  }, [suggestions.data, value]);

  const showSuggestions = open && availableSuggestions.length > 0 && input.trim().length > 0;

  useEffect(() => {
    setOpen(availableSuggestions.length > 0 && input.trim().length > 0);
  }, [availableSuggestions.length, input]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const root = rootRef.current;
    if (!showSuggestions || !panel || !root) return;

    const rect = root.getBoundingClientRect();
    panel.style.position = "fixed";
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.left = `${rect.left}px`;
    panel.style.width = `${rect.width}px`;
    panel.style.margin = "0";
    panel.style.inset = "unset";
    panel.style.zIndex = "50";
    if (typeof panel.showPopover === "function") {
      try {
        panel.showPopover();
      } catch {
        // Already open.
      }
    }
  }, [showSuggestions]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !showSuggestions) return;
    const onToggle = (event: Event) => {
      const toggle = event as ToggleEvent;
      if (toggle.newState === "closed") setOpen(false);
    };
    panel.addEventListener("toggle", onToggle);
    return () => panel.removeEventListener("toggle", onToggle);
  }, [showSuggestions]);

  useEffect(() => {
    if (!showSuggestions) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showSuggestions]);

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag) return;
    if (value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setInput("");
      setOpen(false);
      return;
    }
    onChange([...value, tag]);
    setInput("");
    setOpen(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  };

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-base text-ink outline-none focus-within:border-fern focus-within:ring-4 focus-within:ring-fern/15 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-50">
        {value.map((tag) => (
          <span key={tag} className="inline-flex h-8 items-center gap-1 rounded-full bg-oat px-3 text-sm font-semibold dark:bg-stone-800">
            #{tag}
            <button className="grid h-5 w-5 place-items-center rounded-full hover:bg-stone-200 dark:hover:bg-stone-700" type="button" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          className="min-w-28 flex-1 bg-transparent outline-none"
          value={input}
          aria-autocomplete="list"
          aria-controls={panelId}
          aria-expanded={showSuggestions}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              addTag(input);
            }
            if (event.key === "Backspace" && input === "" && value.length > 0) {
              removeTag(value[value.length - 1]);
            }
          }}
          onBlur={() => addTag(input)}
          placeholder={value.length === 0 ? placeholder : ""}
        />
      </div>
      {showSuggestions && (
        <div ref={panelRef} id={panelId} popover="auto" className="popover-panel overflow-hidden p-0">
          {availableSuggestions.map((tag) => (
            <button
              key={tag.id}
              className="block min-h-11 w-full px-4 py-3 text-left text-sm font-semibold hover:bg-mist dark:hover:bg-stone-800"
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                addTag(tag.name);
              }}
            >
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
