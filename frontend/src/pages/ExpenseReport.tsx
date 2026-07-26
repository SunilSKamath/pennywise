import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ExpenseRow } from "../components/ExpenseRow";
import { Skeleton } from "../components/Skeleton";
import { TagInput } from "../components/TagInput";
import { api, type Expense } from "../lib/api";
import { categoryLabel, formatMoney, inputDate } from "../lib/utils";

function defaultFrom() {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  return inputDate(date);
}

function sumExpenses(expenses: Expense[]) {
  return expenses.reduce((sum, expense) => sum + expense.converted_amount_minor, 0);
}

export function ExpenseReport() {
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(() => inputDate(new Date()));
  const [search, setSearch] = useState("");
  const [categoryID, setCategoryID] = useState<number | "">("");
  const [paymentSourceID, setPaymentSourceID] = useState<number | "">("");
  const [tags, setTags] = useState<string[]>([]);

  const filters = { date_from: dateFrom, date_to: dateTo, search, category_id: categoryID, payment_source_id: paymentSourceID, tags, limit: 200 };
  const expenses = useQuery({ queryKey: ["expense-report", filters], queryFn: () => api.expenses(filters) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });

  const rows = expenses.data ?? [];
  const currency = rows[0]?.converted_currency_code ?? rows[0]?.original_currency_code ?? "INR";
  const total = sumExpenses(rows);
  const average = rows.length ? total / rows.length : 0;

  const byCategory = useMemo(() => {
    const totals = new Map<number, number>();
    rows.forEach((expense) => totals.set(expense.category_id, (totals.get(expense.category_id) ?? 0) + expense.converted_amount_minor));
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [rows]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-semibold text-fern">Date range</p>
        <h1 className="page-title">Expense Report</h1>
      </header>

      <section className="panel space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input className="control" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input className="control" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <select className="control" value={categoryID} onChange={(event) => setCategoryID(event.target.value ? Number(event.target.value) : "")}>
            <option value="">All categories</option>
            {(categories.data ?? []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select className="control" value={paymentSourceID} onChange={(event) => setPaymentSourceID(event.target.value ? Number(event.target.value) : "")}>
            <option value="">All payments</option>
            {(paymentSources.data ?? []).map((source) => <option key={source.id} value={source.id}>{source.name}</option>)}
          </select>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-stone-400" />
            <input className="control w-full pl-12" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" />
          </label>
        </div>
        <TagInput value={tags} onChange={setTags} placeholder="Filter by tags" />
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <ReportStat label="Total spend" value={formatMoney(total, currency)} loading={expenses.isLoading} />
        <ReportStat label="Transactions" value={String(rows.length)} loading={expenses.isLoading} />
        <ReportStat label="Average" value={formatMoney(average, currency)} loading={expenses.isLoading} />
      </section>

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
                const share = total > 0 ? (amount / total) * 100 : 0;
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
              <Skeleton className="h-16" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-stone-500 dark:text-stone-400">No matching expenses.</p>
          ) : (
            rows.map((expense) => (
              <ExpenseRow key={expense.id} expense={expense} categories={categories.data ?? []} paymentSources={paymentSources.data ?? []} />
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
