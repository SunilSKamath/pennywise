import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, PiggyBank, Plus, Target, Trash2, TrendingDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { MonthField } from "../components/DateField";
import { SelectMenu } from "../components/SelectMenu";
import { Skeleton } from "../components/Skeleton";
import { api, type Budget, type Category } from "../lib/api";
import { cn, formatMoney, categoryLabel, monthLabel } from "../lib/utils";

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

function activeSubcategories(category?: Category) {
  return (category?.subcategories ?? []).filter((item) => !item.deleted);
}

function budgetTitle(budget: Budget, categories: Category[]) {
  const category = categories.find((item) => item.id === budget.category_id);
  const name = category ? categoryLabel(category) : `Category ${budget.category_id}`;
  return budget.subcategory_name ? `${name} · ${budget.subcategory_name}` : name;
}

function plannedBudget(budgets: Budget[]) {
  const categoryLevel = new Set(budgets.filter((budget) => budget.subcategory_id == null).map((budget) => budget.category_id));
  return budgets.reduce((sum, budget) => {
    if (budget.subcategory_id != null && categoryLevel.has(budget.category_id)) return sum;
    return sum + budget.amount_minor;
  }, 0);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function SavingsStat({
  icon: Icon,
  label,
  value,
  loading,
  tone = "fern"
}: {
  icon: typeof PiggyBank;
  label: string;
  value: string;
  loading?: boolean;
  tone?: "fern" | "coral";
}) {
  return (
    <article className="panel p-4">
      <Icon className={tone === "coral" ? "h-5 w-5 text-coral" : "h-5 w-5 text-fern"} />
      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl font-extrabold">{value}</p>}
    </article>
  );
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

export function Budgets() {
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonth);
  const [scope, setScope] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");
  const [editing, setEditing] = useState<Budget | null>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.budgets(month) });
  const dashboard = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });

  const scopeOptions = useMemo(() => {
    const used = new Set((budgets.data ?? []).map((budget) => `${budget.category_id}:${budget.subcategory_id ?? ""}`));
    return (categories.data ?? []).flatMap((category) => {
      const options: { id: string; name: string }[] = [];
      if (!used.has(`${category.id}:`)) {
        options.push({ id: `c:${category.id}`, name: categoryLabel(category) });
      }
      activeSubcategories(category).forEach((subcategory) => {
        if (!used.has(`${category.id}:${subcategory.id}`)) {
          options.push({ id: `s:${subcategory.id}`, name: `${categoryLabel(category)} · ${subcategory.name}` });
        }
      });
      return options;
    });
  }, [budgets.data, categories.data]);

  const upsertBudget = useMutation({
    mutationFn: api.upsertBudget,
    onSuccess: async () => {
      setEditing(null);
      setScope("");
      setAmount("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["budgets", month] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard", month] })
      ]);
    }
  });

  const removeBudget = useMutation({
    mutationFn: api.deleteBudget,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["budgets", month] });
    }
  });

  const totalBudget = plannedBudget(budgets.data ?? []);
  const totalSpent = dashboard.data?.month_total ?? 0;
  const remaining = totalBudget - totalSpent;
  const savingsRate = totalBudget > 0 ? Math.max(0, (remaining / totalBudget) * 100) : 0;
  const displayCurrency = budgets.data?.[0]?.currency_code ?? dashboard.data?.by_category[0]?.currency_code ?? currency;

  useEffect(() => {
    setEditing(null);
    setScope("");
    setAmount("");
  }, [month]);

  const cancelEdit = () => {
    setEditing(null);
    setScope("");
    setAmount("");
  };

  const startEdit = (budget: Budget) => {
    setEditing(budget);
    setScope(budget.subcategory_id ? `s:${budget.subcategory_id}` : `c:${budget.category_id}`);
    setAmount((budget.amount_minor / 100).toFixed(2));
    setCurrency(budget.currency_code);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Limits</p>
          <h1 className="page-title">Budgets</h1>
        </div>
        <MonthField className="h-11 w-[9.5rem] text-sm" value={month} onChange={setMonth} />
      </header>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">{monthLabel(month)} budget</p>
          {budgets.isLoading ? (
            <Skeleton className="mt-3 h-10 w-44 bg-white/20" />
          ) : (
            <>
              <p className="mt-2 text-4xl font-extrabold">{formatMoney(totalBudget, displayCurrency)}</p>
              <p className="mt-1 text-sm text-white/75">{formatMoney(totalSpent, displayCurrency)} spent so far</p>
            </>
          )}
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">{monthLabel(month)} available after budget</p>
          {dashboard.isLoading || budgets.isLoading ? (
            <Skeleton className="mt-3 h-10 w-44 bg-white/20" />
          ) : (
            <p className="mt-2 text-4xl font-extrabold">{formatMoney(Math.max(0, remaining), displayCurrency)}</p>
          )}
          <p className="mt-2 text-sm text-white/75">
            {totalBudget > 0 ? `${savingsRate.toFixed(0)}% of planned budget left` : "Set budgets to estimate savings"}
          </p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <SavingsStat icon={Target} label="Planned budget" value={formatMoney(totalBudget, displayCurrency)} loading={budgets.isLoading} />
        <SavingsStat icon={TrendingDown} label="Spent" value={formatMoney(totalSpent, displayCurrency)} loading={dashboard.isLoading} />
        <SavingsStat icon={PiggyBank} label={remaining >= 0 ? "Remaining" : "Over plan"} value={formatMoney(Math.abs(remaining), displayCurrency)} loading={dashboard.isLoading || budgets.isLoading} tone={remaining >= 0 ? "fern" : "coral"} />
      </section>

      <section className="panel p-4">
        <h2 className="mb-4 text-lg font-extrabold">Savings by budget</h2>
        {(budgets.data ?? []).length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">Create a category or subcategory budget to track what remains available each month.</p>
        ) : (
          <div className="space-y-4">
            {(budgets.data ?? []).map((budget) => {
              const left = budget.amount_minor - budget.spent_minor;
              const percent = budget.amount_minor > 0 ? Math.min(100, (budget.spent_minor / budget.amount_minor) * 100) : 0;
              return (
                <div key={budget.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{budgetTitle(budget, categories.data ?? [])}</span>
                    <span className={left >= 0 ? "font-bold text-fern" : "font-bold text-coral"}>
                      {left >= 0 ? `${formatMoney(left, budget.currency_code)} left` : `${formatMoney(Math.abs(left), budget.currency_code)} over`}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                    <div className={left >= 0 ? "h-full rounded-full bg-fern" : "h-full rounded-full bg-coral"} style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel space-y-4 p-4 sm:p-5">
        <h2 className="text-lg font-extrabold">{editing ? "Edit budget" : "Set a budget"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {editing ? (
            <p className="control flex items-center font-semibold">{budgetTitle(editing, categories.data ?? [])}</p>
          ) : (
            <SelectMenu
              label="Budget for"
              placeholder="Category or subcategory"
              options={scopeOptions}
              value={scope}
              onChange={setScope}
            />
          )}
          <input className="control" inputMode="decimal" placeholder="Monthly limit" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <SelectMenu
            label="Currency"
            placeholder="Currency"
            options={currencies.map((code) => ({ id: code, name: code }))}
            value={currency}
            onChange={setCurrency}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={upsertBudget.isPending || (!editing && !scope) || !amount}
            onClick={() => {
              if (editing) {
                upsertBudget.mutate({
                  category_id: editing.category_id,
                  ...(editing.subcategory_id ? { subcategory_id: editing.subcategory_id } : {}),
                  month: editing.month,
                  amount_minor: Math.round(Number(amount) * 100),
                  currency_code: currency
                });
                return;
              }
              const categoryMatch = /^c:(\d+)$/.exec(scope);
              const subcategoryMatch = /^s:(\d+)$/.exec(scope);
              const subcategoryID = subcategoryMatch ? Number(subcategoryMatch[1]) : undefined;
              const category = categoryMatch
                ? categories.data?.find((item) => item.id === Number(categoryMatch[1]))
                : categories.data?.find((item) => activeSubcategories(item).some((subcategory) => subcategory.id === subcategoryID));
              if (!category) return;
              upsertBudget.mutate({
                category_id: category.id,
                ...(subcategoryID ? { subcategory_id: subcategoryID } : {}),
                month,
                amount_minor: Math.round(Number(amount) * 100),
                currency_code: currency
              });
            }}
          >
            <Plus className="h-5 w-5" />
            {upsertBudget.isPending ? "Saving" : editing ? "Save changes" : "Save budget"}
          </Button>
          {editing && (
            <Button variant="secondary" type="button" onClick={cancelEdit}>
              <X className="h-5 w-5" />
              Cancel
            </Button>
          )}
        </div>
        {upsertBudget.error && <p className="rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{upsertBudget.error.message}</p>}
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Budgets</h2>
        {budgets.isLoading ? (
          <div className="panel p-4">
            <Skeleton className="mb-3 h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (budgets.data ?? []).length === 0 ? (
          <div className="panel p-6 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400">Set a monthly limit for a category, or for one of its subcategories.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(budgets.data ?? []).map((budget) => {
              const remainingAmount = budget.amount_minor - budget.spent_minor;
              const over = remainingAmount < 0;
              return (
                <article key={budget.id} className="panel space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold">{budgetTitle(budget, categories.data ?? [])}</p>
                      <p className={cn("text-sm font-semibold", over ? "text-coral" : "text-fern")}>
                        {formatMoney(budget.spent_minor, budget.currency_code)} of {formatMoney(budget.amount_minor, budget.currency_code)}
                        {over ? " · over budget" : ` · ${formatMoney(remainingAmount, budget.currency_code)} left`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        className="grid h-10 w-10 place-items-center rounded-xl text-ink transition hover:bg-stone-100 dark:hover:bg-stone-800"
                        aria-label="Edit budget"
                        type="button"
                        onClick={() => startEdit(budget)}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        className="grid h-10 w-10 place-items-center rounded-xl text-coral transition hover:bg-coral/10"
                        aria-label="Delete budget"
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
            })}
          </div>
        )}
      </section>
    </div>
  );
}
