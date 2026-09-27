import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PiggyBank, Plus, Target, Trash2, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { cn, formatMoney, categoryLabel, monthLabel } from "../lib/utils";

const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

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
  const [categoryID, setCategoryID] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("INR");

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.budgets(month) });
  const dashboard = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });

  const availableCategories = useMemo(() => {
    const used = new Set((budgets.data ?? []).map((budget) => budget.category_id));
    return (categories.data ?? []).filter((category) => !used.has(category.id));
  }, [budgets.data, categories.data]);

  const upsertBudget = useMutation({
    mutationFn: api.upsertBudget,
    onSuccess: async () => {
      setCategoryID("");
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

  const totalBudget = (budgets.data ?? []).reduce((sum, budget) => sum + budget.amount_minor, 0);
  const totalSpent = dashboard.data?.month_total ?? 0;
  const remaining = totalBudget - totalSpent;
  const savingsRate = totalBudget > 0 ? Math.max(0, (remaining / totalBudget) * 100) : 0;
  const displayCurrency = budgets.data?.[0]?.currency_code ?? dashboard.data?.by_category[0]?.currency_code ?? currency;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Limits</p>
          <h1 className="page-title">Budgets</h1>
        </div>
        <input className="control h-11 w-[9.5rem] text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
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
        <h2 className="mb-4 text-lg font-extrabold">Savings by category plan</h2>
        {(budgets.data ?? []).length === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">Create category budgets to track what remains available each month.</p>
        ) : (
          <div className="space-y-4">
            {(budgets.data ?? []).map((budget) => {
              const category = categories.data?.find((item) => item.id === budget.category_id);
              const left = budget.amount_minor - budget.spent_minor;
              const percent = budget.amount_minor > 0 ? Math.min(100, (budget.spent_minor / budget.amount_minor) * 100) : 0;
              return (
                <div key={budget.id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm">
                    <span className="truncate font-semibold">{category ? categoryLabel(category) : `Category ${budget.category_id}`}</span>
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
        <h2 className="text-lg font-extrabold">Set category budget</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <select className="control" value={categoryID} onChange={(event) => setCategoryID(event.target.value ? Number(event.target.value) : "")}>
            <option value="">Select category</option>
            {availableCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryLabel(category)}
              </option>
            ))}
          </select>
          <input className="control" inputMode="decimal" placeholder="Monthly limit" value={amount} onChange={(event) => setAmount(event.target.value)} />
          <select className="control" value={currency} onChange={(event) => setCurrency(event.target.value)}>
            {currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={upsertBudget.isPending || !categoryID || !amount}
          onClick={() =>
            upsertBudget.mutate({
              category_id: Number(categoryID),
              month,
              amount_minor: Math.round(Number(amount) * 100),
              currency_code: currency
            })
          }
        >
          <Plus className="h-5 w-5" />
          {upsertBudget.isPending ? "Saving" : "Save budget"}
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-extrabold">Category budgets</h2>
        {budgets.isLoading ? (
          <div className="panel p-4">
            <Skeleton className="mb-3 h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : (budgets.data ?? []).length === 0 ? (
          <div className="panel p-6 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400">Set monthly limits per category to track spending against your plan.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(budgets.data ?? []).map((budget) => {
              const category = categories.data?.find((item) => item.id === budget.category_id);
              const remaining = budget.amount_minor - budget.spent_minor;
              const over = remaining < 0;
              return (
                <article key={budget.id} className="panel space-y-3 p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-extrabold">{category ? categoryLabel(category) : `Category ${budget.category_id}`}</p>
                      <p className={cn("text-sm font-semibold", over ? "text-coral" : "text-fern")}>
                        {formatMoney(budget.spent_minor, budget.currency_code)} of {formatMoney(budget.amount_minor, budget.currency_code)}
                        {over ? " · over budget" : ` · ${formatMoney(remaining, budget.currency_code)} left`}
                      </p>
                    </div>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-xl text-coral transition hover:bg-coral/10"
                      aria-label="Delete budget"
                      onClick={() => removeBudget.mutate(budget.id)}
                      disabled={removeBudget.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
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
