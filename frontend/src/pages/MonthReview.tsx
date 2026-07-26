import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { categoryLabel, currentMonth, formatMoney, monthBounds, monthLabel } from "../lib/utils";

function previousMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthReview() {
  const [month, setMonth] = useState(currentMonth);
  const previous = previousMonth(month);
  const bounds = monthBounds(month);
  const dashboard = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });
  const previousDashboard = useQuery({ queryKey: ["dashboard", previous], queryFn: () => api.dashboard(previous) });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.budgets(month), retry: false });
  const expenses = useQuery({ queryKey: ["month-expenses", month], queryFn: () => api.expenses({ ...bounds, limit: 200 }) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });

  const total = dashboard.data?.month_total ?? 0;
  const prevTotal = previousDashboard.data?.month_total ?? 0;
  const currency = dashboard.data?.by_category[0]?.currency_code ?? "INR";
  const delta = prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : null;
  const largest = expenses.data?.slice().sort((a, b) => b.converted_amount_minor - a.converted_amount_minor)[0];
  const overBudgets = (budgets.data ?? []).filter((budget) => budget.spent_minor > budget.amount_minor);

  const insight = useMemo(() => {
    if (total === 0) return "No expenses recorded for this month yet.";
    if (overBudgets.length > 0) return `${overBudgets.length} budget ${overBudgets.length === 1 ? "category is" : "categories are"} over limit.`;
    if (delta !== null && delta < 0) return "Spending is lower than last month.";
    return "Spending is within the tracked budget categories.";
  }, [total, overBudgets.length, delta]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Evaluate</p>
          <h1 className="page-title">Month Review</h1>
        </div>
        <input className="control h-11 w-[9.5rem] text-sm" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </header>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">{monthLabel(month)} result</p>
          {dashboard.isLoading ? <Skeleton className="mt-3 h-10 w-44 bg-white/20" /> : <p className="mt-2 text-4xl font-extrabold">{formatMoney(total, currency)}</p>}
          {delta !== null && (
            <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
              {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {Math.abs(delta).toFixed(1)}% {delta >= 0 ? "higher" : "lower"} than {monthLabel(previous)}
            </p>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="panel p-4">
          <CheckCircle2 className="h-5 w-5 text-fern" />
          <h2 className="mt-3 text-lg font-extrabold">Summary</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{insight}</p>
        </article>
        <article className="panel p-4">
          <AlertTriangle className="h-5 w-5 text-coral" />
          <h2 className="mt-3 text-lg font-extrabold">Budget exceptions</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{overBudgets.length} categories need attention.</p>
        </article>
        <article className="panel p-4">
          <TrendingUp className="h-5 w-5 text-fern" />
          <h2 className="mt-3 text-lg font-extrabold">Largest expense</h2>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {largest ? `${largest.merchant || "Expense"} · ${formatMoney(largest.converted_amount_minor, largest.converted_currency_code)}` : "No expense yet"}
          </p>
        </article>
      </section>

      <section className="panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Category performance</h2>
          <Link className="text-sm font-semibold text-fern" to="/reports">Open report</Link>
        </div>
        <div className="space-y-4">
          {(dashboard.data?.by_category ?? []).map((row) => {
            const category = categories.data?.find((item) => item.id === row.id);
            const budget = budgets.data?.find((item) => item.category_id === row.id);
            const max = budget?.amount_minor ?? total;
            const percent = max > 0 ? Math.min(100, (row.amount_minor / max) * 100) : 0;
            const over = budget ? row.amount_minor > budget.amount_minor : false;
            return (
              <div key={row.id}>
                <div className="mb-1 flex justify-between gap-3 text-sm">
                  <span className="truncate font-semibold">{category ? categoryLabel(category) : row.name}</span>
                  <span className={over ? "font-bold text-coral" : "font-bold"}>{formatMoney(row.amount_minor, row.currency_code)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                  <div className={over ? "h-full rounded-full bg-coral" : "h-full rounded-full bg-fern"} style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {budget ? `Budget ${formatMoney(budget.amount_minor, budget.currency_code)}` : "No budget set"} · {row.transaction_count} transactions
                </p>
              </div>
            );
          })}
          {!dashboard.isLoading && (dashboard.data?.by_category.length ?? 0) === 0 && (
            <p className="text-sm text-stone-500 dark:text-stone-400">No category spend to evaluate.</p>
          )}
        </div>
      </section>
    </div>
  );
}
