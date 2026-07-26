import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
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
  const suggestions = useQuery({
    queryKey: ["tags", input],
    queryFn: () => api.tags(input),
    enabled: input.trim().length > 0
  });

  const availableSuggestions = useMemo(() => {
    const selected = new Set(value.map((tag) => tag.toLowerCase()));
    return (suggestions.data ?? []).filter((tag) => !selected.has(tag.name.toLowerCase())).slice(0, 6);
  }, [suggestions.data, value]);

  const addTag = (raw: string) => {
    const tag = raw.trim().replace(/^#/, "");
    if (!tag) return;
    if (value.some((item) => item.toLowerCase() === tag.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, tag]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item.toLowerCase() !== tag.toLowerCase()));
  };

  return (
    <div className="relative">
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
      {availableSuggestions.length > 0 && input.trim() && (
        <div className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-soft dark:border-stone-700 dark:bg-stone-900">
          {availableSuggestions.map((tag) => (
            <button
              key={tag.id}
              className="block w-full px-4 py-3 text-left text-sm font-semibold hover:bg-mist dark:hover:bg-stone-800"
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
