import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, PiggyBank, Plus, Target, Trash2, TrendingDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { SelectMenu } from "../components/SelectMenu";
import { Skeleton } from "../components/Skeleton";
import { api, type YearlyBudget } from "../lib/api";
import { categoryLabel, cn, formatMoney } from "../lib/utils";

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

function currentYear() {
  return String(new Date().getFullYear());
}

function BudgetProgress({ spent, budget }: { spent: number; budget: number }) {
  const percent = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const over = spent > budget;
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
      <div className={cn("h-full rounded-full transition-all", over ? "bg-coral" : "bg-fern")} style={{ width: `${percent}%` }} />
    </div>
  );
}

export function YearlyBudgets() {
  const queryClient = useQueryClient();
  const [year, setYear] = useState(currentYear);
  const [categoryID, setCategoryID] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [editing, setEditing] = useState<YearlyBudget | null>(null);

  useEffect(() => {
    setEditing(null);
    setCategoryID("");
    setAmount("");
  }, [year]);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const budgets = useQuery({ queryKey: ["yearly-budgets", year], queryFn: () => api.yearlyBudgets(year) });
  const enabled = (categories.data ?? []).filter((category) => category.yearly_budget_enabled);
  const available = useMemo(() => {
    const used = new Set((budgets.data ?? []).map((budget) => budget.category_id));
    return (categories.data ?? []).filter((category) => category.yearly_budget_enabled && !used.has(category.id));
  }, [categories.data, budgets.data]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["yearly-budgets", year] });
  };

  const clearForm = () => {
    setEditing(null);
    setCategoryID("");
    setAmount("");
  };

  const upsertBudget = useMutation({
    mutationFn: api.upsertYearlyBudget,
    onSuccess: async () => {
      clearForm();
      await refresh();
    }
  });

  const removeBudget = useMutation({
    mutationFn: api.deleteYearlyBudget,
    onSuccess: async () => {
      if (editing) clearForm();
      await refresh();
    }
  });

  const rows = budgets.data ?? [];
  const totalBudget = rows.reduce((sum, budget) => sum + budget.amount_minor, 0);
  const totalSpent = rows.reduce((sum, budget) => sum + budget.spent_minor, 0);
  const remaining = totalBudget - totalSpent;
  const displayCurrency = rows[0]?.currency_code ?? currency;

  const save = () => {
    const chosen = editing?.category_id ?? categoryID;
    if (!chosen || !amount) return;
    upsertBudget.mutate({
      category_id: Number(chosen),
      year: editing?.year ?? year,
      amount_minor: Math.round(Number(amount) * 100),
      currency_code: currency
    });
  };

  const startEdit = (budget: YearlyBudget) => {
    setEditing(budget);
    setCategoryID(budget.category_id);
    setAmount((budget.amount_minor / 100).toFixed(2));
    setCurrency(budget.currency_code);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Limits</p>
          <h1 className="page-title">Yearly budgets</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900" type="button" aria-label="Previous year" onClick={() => setYear(String(Number(year) - 1))}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="w-16 text-center text-lg font-extrabold">{year}</p>
          <button className="grid h-11 w-11 place-items-center rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900" type="button" aria-label="Next year" onClick={() => setYear(String(Number(year) + 1))}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="panel p-4">
          <Target className="h-5 w-5 text-fern" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Planned</p>
          {budgets.isLoading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl font-extrabold">{formatMoney(totalBudget, displayCurrency)}</p>}
        </article>
        <article className="panel p-4">
          <TrendingDown className="h-5 w-5 text-fern" />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">Spent</p>
          {budgets.isLoading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl font-extrabold">{formatMoney(totalSpent, displayCurrency)}</p>}
        </article>
        <article className="panel p-4">
          <PiggyBank className={remaining >= 0 ? "h-5 w-5 text-fern" : "h-5 w-5 text-coral"} />
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{remaining >= 0 ? "Remaining" : "Over plan"}</p>
          {budgets.isLoading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl font-extrabold">{formatMoney(Math.abs(remaining), displayCurrency)}</p>}
        </article>
      </section>

      {enabled.length === 0 ? (
        <section className="panel p-6 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400">Yearly budgets appear here after an admin turns them on for a category.</p>
        </section>
      ) : (
        <section className="panel space-y-4 p-4 sm:p-5">
          <h2 className="text-lg font-extrabold">{editing ? "Edit yearly budget" : "Set a yearly budget"}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {editing ? (
              <p className="control flex items-center font-semibold">{categoryLabel(categories.data?.find((category) => category.id === editing.category_id) ?? { name: `Category ${editing.category_id}`, emoji: "📦" })}</p>
            ) : (
              <SelectMenu
                label="Category"
                placeholder="Select category"
                options={available.map((category) => ({ id: category.id, name: categoryLabel(category) }))}
                value={categoryID}
                onChange={setCategoryID}
              />
            )}
            <input className="control" inputMode="decimal" placeholder="Yearly limit" value={amount} onChange={(event) => setAmount(event.target.value)} />
            <SelectMenu
              label="Currency"
              placeholder="Currency"
              options={currencies.map((code) => ({ id: code, name: code }))}
              value={currency}
              onChange={setCurrency}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={upsertBudget.isPending || (!editing && !categoryID) || !amount} onClick={save}>
              <Plus className="h-5 w-5" />
              {upsertBudget.isPending ? "Saving" : editing ? "Save changes" : "Save budget"}
            </Button>
            {editing && (
              <Button variant="secondary" type="button" onClick={clearForm}>
                <X className="h-5 w-5" />
                Cancel
              </Button>
            )}
          </div>
          {upsertBudget.error && <p className="rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{upsertBudget.error.message}</p>}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">{year} budgets</h2>
        {budgets.isLoading ? (
          <div className="panel p-4">
            <Skeleton className="h-20" />
          </div>
        ) : rows.length === 0 ? (
          <div className="panel p-6 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400">No yearly budgets for {year}.</p>
          </div>
        ) : (
          rows.map((budget) => {
            const category = categories.data?.find((item) => item.id === budget.category_id);
            const left = budget.amount_minor - budget.spent_minor;
            const over = left < 0;
            return (
              <article key={budget.id} className="panel space-y-3 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-extrabold">{category ? categoryLabel(category) : `Category ${budget.category_id}`}</p>
                    <p className={cn("text-sm font-semibold", over ? "text-coral" : "text-fern")}>
                      {formatMoney(budget.spent_minor, budget.currency_code)} of {formatMoney(budget.amount_minor, budget.currency_code)}
                      {over ? " · over budget" : ` · ${formatMoney(left, budget.currency_code)} left`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-stone-100 disabled:opacity-40 dark:hover:bg-stone-800"
                      aria-label="Edit yearly budget"
                      type="button"
                      disabled={!category?.yearly_budget_enabled}
                      onClick={() => startEdit(budget)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-xl text-coral transition hover:bg-coral/10"
                      aria-label="Delete yearly budget"
                      type="button"
                      onClick={() => removeBudget.mutate(budget.id)}
                      disabled={removeBudget.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <BudgetProgress spent={budget.spent_minor} budget={budget.amount_minor} />
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
