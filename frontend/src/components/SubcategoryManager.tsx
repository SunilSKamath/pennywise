import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type Category, type Subcategory } from "../lib/api";
import { categoryEmoji, cn } from "../lib/utils";

export function SubcategoryManager({ categories }: { categories: Category[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirmingID, setConfirmingID] = useState<number | null>(null);
  const [duplicate, setDuplicate] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const children = (category.subcategories ?? []).filter((subcategory) => !subcategory.deleted);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const create = useMutation({
    mutationFn: (value: string) => api.createSubcategory(category.id, value),
    onSuccess: async () => {
      setName("");
      inputRef.current?.focus();
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const remove = useMutation({
    mutationFn: (subcategory: Subcategory) => api.deleteSubcategory(category.id, subcategory.id),
    onSuccess: async () => {
      setConfirmingID(null);
      await queryClient.invalidateQueries({ queryKey: ["categories"] });
    }
  });

  const submit = () => {
    const value = name.trim();
    if (!value || create.isPending) return;
    if (children.some((subcategory) => subcategory.name.toLowerCase() === value.toLowerCase())) {
      create.reset();
      setDuplicate(`${value} is already in ${category.name}.`);
      return;
    }
    setDuplicate("");
    create.mutate(value);
  };

  const cancelAdd = () => {
    setAdding(false);
    setName("");
    setDuplicate("");
    create.reset();
  };

  const error = duplicate || create.error?.message || remove.error?.message;

  return (
    <div className="rounded-2xl bg-mist p-4 dark:bg-stone-800">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl dark:bg-stone-950" aria-hidden="true">
          {categoryEmoji(category)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{category.name}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {children.length === 0 ? "No subcategories" : `${children.length} ${children.length === 1 ? "subcategory" : "subcategories"}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {children.map((subcategory) =>
          confirmingID === subcategory.id ? (
            <span key={subcategory.id} className="inline-flex h-9 items-center gap-1 rounded-full bg-coral/10 pl-3 pr-1 text-sm font-semibold text-coral">
              Remove {subcategory.name}?
              <button
                className="grid h-7 w-7 place-items-center rounded-full bg-coral text-white transition hover:bg-coral/90 disabled:opacity-60"
                type="button"
                aria-label={`Confirm remove ${subcategory.name}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(subcategory)}
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                className="grid h-7 w-7 place-items-center rounded-full text-stone-500 transition hover:bg-white dark:hover:bg-stone-900"
                type="button"
                aria-label="Keep subcategory"
                onClick={() => setConfirmingID(null)}
              >
                <X className="h-4 w-4" />
              </button>
            </span>
          ) : (
            <span
              key={subcategory.id}
              className="group inline-flex h-9 items-center gap-1 rounded-full bg-white pl-3 pr-1 text-sm font-semibold text-ink shadow-sm dark:bg-stone-950 dark:text-stone-50"
            >
              {subcategory.name}
              <button
                className="grid h-7 w-7 place-items-center rounded-full text-stone-400 transition hover:bg-coral/10 hover:text-coral md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                type="button"
                aria-label={`Remove ${subcategory.name}`}
                onClick={() => {
                  remove.reset();
                  setConfirmingID(subcategory.id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          )
        )}

        {adding ? (
          <form
            className="inline-flex h-9 items-center gap-1 rounded-full border border-fern bg-white pl-3 pr-1 ring-4 ring-fern/15 dark:bg-stone-950"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              ref={inputRef}
              className="w-32 bg-transparent text-sm font-semibold outline-none placeholder:text-stone-400"
              value={name}
              maxLength={80}
              onChange={(event) => {
                setName(event.target.value);
                setDuplicate("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") cancelAdd();
              }}
              placeholder="New subcategory"
              aria-label={`New subcategory for ${category.name}`}
            />
            <button
              className={cn(
                "grid h-7 w-7 place-items-center rounded-full transition",
                name.trim() ? "bg-fern text-white hover:bg-fern/90" : "text-stone-300 dark:text-stone-600"
              )}
              type="submit"
              aria-label="Save subcategory"
              disabled={!name.trim() || create.isPending}
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              className="grid h-7 w-7 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 dark:hover:bg-stone-900"
              type="button"
              aria-label="Cancel"
              onClick={cancelAdd}
            >
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <button
            className="inline-flex h-9 items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 text-sm font-semibold text-stone-500 transition hover:border-fern hover:text-fern dark:border-stone-600 dark:text-stone-400"
            type="button"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm font-semibold text-coral">{error}</p>}
    </div>
  );
}
