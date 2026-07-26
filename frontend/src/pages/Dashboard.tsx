import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, CirclePlus, Receipt, Target, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { ExpenseRow } from "../components/ExpenseRow";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { cn, formatMoney, categoryLabel } from "../lib/utils";

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(value: string, delta: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

function daysInMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

function expenseInMonth(expenseDate: string, month: string) {
  return expenseDate.slice(0, 7) === month;
}

function monthBounds(value: string) {
  const [year, month] = value.split("-").map(Number);
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end = new Date(year, month, 0).toISOString().slice(0, 10);
  return { date_from: start, date_to: end };
}

function ProgressBar({ value, max, tone = "fern" }: { value: number; max: number; tone?: "fern" | "coral" }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
      <div
        className={cn("h-full rounded-full transition-all", tone === "coral" ? "bg-coral" : "bg-fern")}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function Dashboard() {
  const [month, setMonth] = useState(currentMonth);
  const previousMonth = shiftMonth(month, -1);

  const dashboard = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });
  const previousDashboard = useQuery({ queryKey: ["dashboard", previousMonth], queryFn: () => api.dashboard(previousMonth) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.budgets(month), retry: false });
  const expenses = useQuery({ queryKey: ["expenses", month], queryFn: () => api.expenses({ ...monthBounds(month), limit: 200 }) });

  const currency = dashboard.data?.by_category[0]?.currency_code ?? "INR";
  const topCategory = dashboard.data?.by_category[0];
  const monthTotal = dashboard.data?.month_total ?? 0;
  const previousTotal = previousDashboard.data?.month_total ?? 0;

  const transactionCount = useMemo(
    () => (dashboard.data?.by_category ?? []).reduce((sum, row) => sum + row.transaction_count, 0),
    [dashboard.data?.by_category]
  );

  const monthExpenses = useMemo(
    () => (expenses.data ?? []).filter((expense) => expenseInMonth(expense.expense_date, month)),
    [expenses.data, month]
  );

  const recentExpenses = monthExpenses.slice(0, 5);

  const budgetTotal = useMemo(() => (budgets.data ?? []).reduce((sum, budget) => sum + budget.amount_minor, 0), [budgets.data]);
  const budgetSpent = useMemo(() => (budgets.data ?? []).reduce((sum, budget) => sum + budget.spent_minor, 0), [budgets.data]);
  const overBudgetCount = useMemo(
    () => (budgets.data ?? []).filter((budget) => budget.spent_minor > budget.amount_minor).length,
    [budgets.data]
  );

  const spendChange = previousTotal > 0 ? ((monthTotal - previousTotal) / previousTotal) * 100 : null;
  const avgTransaction = transactionCount > 0 ? monthTotal / transactionCount : 0;
  const dailyAverage = monthTotal / daysInMonth(month);
  const isCurrentMonth = month === currentMonth();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Overview</p>
          <h1 className="page-title">Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900">
            <button
              className="grid h-11 w-11 place-items-center text-stone-500 transition hover:text-fern"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <input
              className="h-11 w-[9.5rem] border-x border-stone-200 bg-transparent px-2 text-center text-sm outline-none dark:border-stone-700"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            <button
              className="grid h-11 w-11 place-items-center text-stone-500 transition hover:text-fern disabled:opacity-40"
              aria-label="Next month"
              disabled={isCurrentMonth}
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <Link className="grid h-11 w-11 place-items-center rounded-xl bg-fern text-white shadow-soft" to="/add" aria-label="Add expense">
            <CirclePlus className="h-5 w-5" />
          </Link>
        </div>
      </header>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">{monthLabel(month)} spend</p>
          {dashboard.isLoading ? (
            <Skeleton className="mt-3 h-10 w-44 bg-white/20" />
          ) : (
            <>
              <p className="mt-2 text-4xl font-extrabold">{formatMoney(monthTotal, currency)}</p>
              {spendChange !== null && (
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-white/90">
                  {spendChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                  {Math.abs(spendChange).toFixed(1)}% vs {monthLabel(previousMonth)}
                </p>
              )}
            </>
          )}
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Transactions" value={String(transactionCount)} hint="this month" loading={dashboard.isLoading} />
          <StatCard label="Avg per expense" value={formatMoney(avgTransaction, currency)} hint="per transaction" loading={dashboard.isLoading} />
          <StatCard label="Daily average" value={formatMoney(dailyAverage, currency)} hint={`over ${daysInMonth(month)} days`} loading={dashboard.isLoading} />
          <StatCard label="Previous month" value={formatMoney(previousTotal, currency)} hint={monthLabel(previousMonth)} loading={previousDashboard.isLoading} />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link className="panel p-4 transition hover:border-fern/30" to="/budgets">
          <div className="flex items-center gap-2 text-sm font-semibold text-fern">
            <Target className="h-4 w-4" />
            Budget usage
          </div>
          <p className="mt-2 text-2xl font-extrabold">{formatMoney(budgetSpent, currency)}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            of {formatMoney(budgetTotal, currency)} across {(budgets.data ?? []).length} categories
          </p>
          <ProgressBar value={budgetSpent} max={budgetTotal || 1} tone={budgetSpent > budgetTotal ? "coral" : "fern"} />
        </Link>
        <div className="panel p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-fern">
            <TrendingUp className="h-4 w-4" />
            Budget alerts
          </div>
          <p className="mt-2 text-2xl font-extrabold">{overBudgetCount}</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">categories over limit</p>
        </div>
        <div className="panel p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-fern">
            <Receipt className="h-4 w-4" />
            Top category
          </div>
          {dashboard.isLoading ? (
            <Skeleton className="mt-3 h-8 w-32" />
          ) : (
            <>
              <p className="mt-2 truncate text-2xl font-extrabold">
                {topCategory
                  ? categoryLabel(categories.data?.find((c) => c.id === topCategory.id) ?? { name: topCategory.name, emoji: "📦" })
                  : "—"}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {topCategory ? formatMoney(topCategory.amount_minor, topCategory.currency_code) : "No spending yet"}
              </p>
            </>
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-extrabold">Spending by category</h2>
            <Link className="text-sm font-semibold text-fern" to="/budgets">
              Manage budgets
            </Link>
          </div>
          <div className="panel p-4">
            {dashboard.isLoading ? (
              <>
                <Skeleton className="mb-4 h-12" />
                <Skeleton className="mb-4 h-12" />
                <Skeleton className="h-12" />
              </>
            ) : (dashboard.data?.by_category.length ?? 0) === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">No expenses recorded for this month yet.</p>
            ) : (
              <div className="space-y-4">
                {(dashboard.data?.by_category ?? []).map((row) => {
                  const category = categories.data?.find((item) => item.id === row.id);
                  const budget = budgets.data?.find((item) => item.category_id === row.id);
                  const share = monthTotal > 0 ? (row.amount_minor / monthTotal) * 100 : 0;
                  const overBudget = budget ? row.amount_minor > budget.amount_minor : false;
                  return (
                    <div key={row.id}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{category ? categoryLabel(category) : row.name}</span>
                        <span className="shrink-0 font-bold">{formatMoney(row.amount_minor, row.currency_code)}</span>
                      </div>
                      <ProgressBar value={row.amount_minor} max={monthTotal} tone={overBudget ? "coral" : "fern"} />
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {share.toFixed(0)}% of spend · {row.transaction_count} transactions
                        {budget ? ` · budget ${formatMoney(budget.amount_minor, budget.currency_code)}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-extrabold">Spending by payment source</h2>
          <div className="panel p-4">
            {dashboard.isLoading ? (
              <>
                <Skeleton className="mb-4 h-12" />
                <Skeleton className="h-12" />
              </>
            ) : (dashboard.data?.by_payment_source.length ?? 0) === 0 ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">Payment source breakdown will appear after your first expense.</p>
            ) : (
              <div className="space-y-4">
                {(dashboard.data?.by_payment_source ?? []).map((row) => {
                  const source = paymentSources.data?.find((item) => item.id === row.id);
                  const share = monthTotal > 0 ? (row.amount_minor / monthTotal) * 100 : 0;
                  return (
                    <div key={row.id}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-semibold">{source?.name ?? row.name}</span>
                        <span className="shrink-0 font-bold">{formatMoney(row.amount_minor, row.currency_code)}</span>
                      </div>
                      <ProgressBar value={row.amount_minor} max={monthTotal} />
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {share.toFixed(0)}% of spend · {row.transaction_count} transactions
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold">Recent expenses</h2>
          <Link className="inline-flex items-center gap-1 text-sm font-semibold text-fern" to="/expenses">
            View all
          </Link>
        </div>
        {expenses.isLoading ? (
          <div className="panel p-4">
            <Skeleton className="mb-3 h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : recentExpenses.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="panel overflow-hidden px-4">
            {recentExpenses.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} categories={categories.data ?? []} paymentSources={paymentSources.data ?? []} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, hint, loading }: { label: string; value: string; hint: string; loading?: boolean }) {
  return (
    <div className="rounded-xl bg-mist p-4 dark:bg-stone-800">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-xl font-extrabold">{value}</p>}
      <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>
    </div>
  );
}
