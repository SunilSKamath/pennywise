import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2, FilterX, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ExpenseRow } from "../components/ExpenseRow";
import { Skeleton } from "../components/Skeleton";
import { TagInput } from "../components/TagInput";
import { api, type Expense, type ExpenseFilters } from "../lib/api";
import { categoryLabel, currentMonth, formatMoney, monthBounds, monthLabel } from "../lib/utils";

function previousMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function Expenses() {
  const queryClient = useQueryClient();
  const startingMonth = currentMonth();
  const startingBounds = monthBounds(startingMonth);
  const [month, setMonth] = useState(startingMonth);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(startingBounds.from);
  const [dateTo, setDateTo] = useState(startingBounds.to);
  const [categoryID, setCategoryID] = useState<number | "">("");
  const [paymentSourceID, setPaymentSourceID] = useState<number | "">("");
  const [tags, setTags] = useState<string[]>([]);

  const filters: ExpenseFilters = {
    search,
    date_from: dateFrom,
    date_to: dateTo,
    category_id: categoryID,
    payment_source_id: paymentSourceID,
    tags,
    limit: 200
  };
  const expenses = useQuery({ queryKey: ["expenses", filters], queryFn: () => api.expenses(filters) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });
  const previous = previousMonth(month);
  const dashboard = useQuery({ queryKey: ["dashboard", month], queryFn: () => api.dashboard(month) });
  const previousDashboard = useQuery({ queryKey: ["dashboard", previous], queryFn: () => api.dashboard(previous) });
  const budgets = useQuery({ queryKey: ["budgets", month], queryFn: () => api.budgets(month), retry: false });
  const bounds = monthBounds(month);
  const monthExpenses = useQuery({
    queryKey: ["expenses", "month", month],
    queryFn: () => api.expenses({ date_from: bounds.from, date_to: bounds.to, limit: 200 })
  });

  const deleteExpense = useMutation({
    mutationFn: api.deleteExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["budgets"] })
      ]);
    }
  });

  const rows = expenses.data ?? [];
  const currency = rows[0]?.converted_currency_code ?? dashboard.data?.by_category[0]?.currency_code ?? "INR";
  const filteredTotal = rows.reduce((sum, expense) => sum + expense.converted_amount_minor, 0);
  const average = rows.length ? filteredTotal / rows.length : 0;
  const byCategory = useMemo(() => {
    const totals = new Map<number, number>();
    rows.forEach((expense) => totals.set(expense.category_id, (totals.get(expense.category_id) ?? 0) + expense.converted_amount_minor));
    return [...totals.entries()].sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [rows]);

  const monthTotal = dashboard.data?.month_total ?? 0;
  const previousTotal = previousDashboard.data?.month_total ?? 0;
  const monthCurrency = dashboard.data?.by_category[0]?.currency_code ?? "INR";
  const delta = previousTotal > 0 ? ((monthTotal - previousTotal) / previousTotal) * 100 : null;
  const largest = monthExpenses.data?.slice().sort((left, right) => right.converted_amount_minor - left.converted_amount_minor)[0];
  const overBudgets = (budgets.data ?? []).filter((budget) => budget.spent_minor > budget.amount_minor);
  const insight = useMemo(() => {
    if (monthTotal === 0) return "No expenses recorded for this month yet.";
    if (overBudgets.length > 0) return `${overBudgets.length} budget ${overBudgets.length === 1 ? "category is" : "categories are"} over limit.`;
    if (delta !== null && delta < 0) return "Spending is lower than last month.";
    return "Spending is within the tracked budget categories.";
  }, [monthTotal, overBudgets.length, delta]);

  const hasFilters = Boolean(search || dateFrom || dateTo || categoryID || paymentSourceID || tags.length > 0);

  const selectMonth = (value: string) => {
    if (!value) return;
    const nextBounds = monthBounds(value);
    setMonth(value);
    setDateFrom(nextBounds.from);
    setDateTo(nextBounds.to);
  };

  const handleDelete = (expense: Expense) => {
    const label = expense.merchant || "this expense";
    if (!window.confirm(`Delete ${label}?`)) return;
    deleteExpense.mutate(expense.id);
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Review</p>
          <h1 className="page-title">Expenses</h1>
        </div>
        <input className="control h-11 w-[9.5rem] text-sm" type="month" value={month} onChange={(event) => selectMonth(event.target.value)} aria-label="Month" />
      </header>

      <section className="panel overflow-hidden">
        <div className="bg-fern p-6 text-white">
          <p className="text-sm font-medium text-white/75">{monthLabel(month)} result</p>
          {dashboard.isLoading ? <Skeleton className="mt-3 h-10 w-44 bg-white/20" /> : <p className="mt-2 text-4xl font-extrabold">{formatMoney(monthTotal, monthCurrency)}</p>}
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
        <h2 className="mb-4 text-lg font-extrabold">Category performance</h2>
        {dashboard.isLoading ? (
          <Skeleton className="h-32" />
        ) : (dashboard.data?.by_category.length ?? 0) === 0 ? (
          <p className="text-sm text-stone-500 dark:text-stone-400">No category spend to evaluate.</p>
        ) : (
          <div className="space-y-4">
            {(dashboard.data?.by_category ?? []).map((row) => {
              const category = categories.data?.find((item) => item.id === row.id);
              const budget = budgets.data?.find((item) => item.category_id === row.id);
              const max = budget?.amount_minor ?? monthTotal;
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
          </div>
        )}
      </section>

      <section className="panel space-y-3 p-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
          <input
            className="control w-full pl-12"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search merchant, notes, category, payment, amount, date"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input className="control" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label="From date" />
          <input className="control" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label="To date" />
          <select className="control" value={categoryID} onChange={(event) => setCategoryID(event.target.value ? Number(event.target.value) : "")}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          <select className="control" value={paymentSourceID} onChange={(event) => setPaymentSourceID(event.target.value ? Number(event.target.value) : "")}>
            <option value="">All payments</option>
            {(paymentSources.data ?? []).map((source) => (
              <option key={source.id} value={source.id}>{source.name}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            disabled={!hasFilters}
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setCategoryID("");
              setPaymentSourceID("");
              setTags([]);
            }}
          >
            <FilterX className="h-5 w-5" />
            Clear
          </Button>
        </div>
        <TagInput value={tags} onChange={setTags} placeholder="Filter by tags" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ReportStat label="Total spend" value={formatMoney(filteredTotal, currency)} loading={expenses.isLoading} />
        <ReportStat label="Transactions" value={String(rows.length)} loading={expenses.isLoading} />
        <ReportStat label="Average" value={formatMoney(average, currency)} loading={expenses.isLoading} />
      </section>

      {deleteExpense.error && <p className="rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{deleteExpense.error.message}</p>}

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-4">
          <div className="mb-4 flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-fern" />
            <h2 className="text-lg font-extrabold">Top categories</h2>
          </div>
          {expenses.isLoading ? (
            <Skeleton className="h-32" />
          ) : byCategory.length === 0 ? (
            <p className="text-sm text-stone-500 dark:text-stone-400">No expenses in this range.</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map(([id, amount]) => {
                const category = categories.data?.find((item) => item.id === id);
                const share = filteredTotal > 0 ? (amount / filteredTotal) * 100 : 0;
                return (
                  <div key={id}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="truncate font-semibold">{category ? categoryLabel(category) : `Category ${id}`}</span>
                      <span className="font-bold">{formatMoney(amount, currency)}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700">
                      <div className="h-full rounded-full bg-fern" style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="panel overflow-hidden px-4">
          {expenses.isLoading ? (
            <div className="py-4">
              <Skeleton className="mb-3 h-16" />
              <Skeleton className="mb-3 h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : rows.length === 0 ? (
            <div className="py-4">
              <EmptyState title={hasFilters ? "No Matching Expenses" : "No Expenses Yet"} />
            </div>
          ) : (
            rows.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                categories={categories.data ?? []}
                paymentSources={paymentSources.data ?? []}
                editable
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function ReportStat({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="panel p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-stone-500 dark:text-stone-400">{label}</p>
      {loading ? <Skeleton className="mt-2 h-8 w-24" /> : <p className="mt-1 text-2xl font-extrabold">{value}</p>}
    </div>
  );
}
