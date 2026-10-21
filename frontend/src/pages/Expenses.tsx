import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarRange, CheckCircle2, Download, FileUp, FilterX, Search, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../components/Button";
import { DateField, MonthField } from "../components/DateField";
import { EmptyState } from "../components/EmptyState";
import { ExpenseRow } from "../components/ExpenseRow";
import { MultiSelect } from "../components/MultiSelect";
import { Skeleton } from "../components/Skeleton";
import { TagInput } from "../components/TagInput";
import { api, type Expense, type ExpenseFilters } from "../lib/api";
import { csvImportTag, expenseCsvFilename, expensesFromCsv, expensesToCsv, sampleExpensesCsv } from "../lib/csv";
import { csvObjectUrl, prefersShareSheet, shareTextFile } from "../lib/download";
import { categoryLabel, cn, currentMonth, formatMoney, monthBounds, monthLabel, todayInputValue } from "../lib/utils";

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
  const [categoryIDs, setCategoryIDs] = useState<number[]>([]);
  const [subcategoryIDs, setSubcategoryIDs] = useState<number[]>([]);
  const [paymentSourceIDs, setPaymentSourceIDs] = useState<number[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [downloadError, setDownloadError] = useState("");
  const [csvUrl, setCsvUrl] = useState("");
  const [sampleUrl, setSampleUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const filters: ExpenseFilters = {
    search,
    date_from: dateFrom,
    date_to: dateTo,
    category_id: categoryIDs,
    subcategory_id: subcategoryIDs,
    payment_source_id: paymentSourceIDs,
    tags,
    limit: 200
  };
  const expenses = useQuery({ queryKey: ["expenses", filters], queryFn: () => api.expenses(filters) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });
  const tagCatalog = useQuery({ queryKey: ["tags", "all"], queryFn: () => api.tags("") });
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
        queryClient.invalidateQueries({ queryKey: ["budgets"] }),
        queryClient.invalidateQueries({ queryKey: ["tags"] })
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

  const hasFilters = Boolean(search || dateFrom || dateTo || categoryIDs.length || subcategoryIDs.length || paymentSourceIDs.length || tags.length > 0);

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

  const csvFilename = expenseCsvFilename(dateFrom, dateTo);
  const downloadDisabled = expenses.isLoading || rows.length === 0;
  const uploadDisabled = importing || categories.isLoading || paymentSources.isLoading;

  useEffect(() => {
    const url = csvObjectUrl(
      sampleExpensesCsv(
        categories.data ?? [],
        paymentSources.data ?? [],
        (tagCatalog.data ?? []).map((tag) => tag.name),
        dateFrom || todayInputValue()
      )
    );
    setSampleUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [categories.data, paymentSources.data, tagCatalog.data, dateFrom]);

  const uploadCsv = async (file: File) => {
    setImporting(true);
    setImportNotice(null);
    try {
      const result = expensesFromCsv(await file.text(), categories.data ?? [], paymentSources.data ?? []);
      if (result.errors.length > 0 || result.payloads.length === 0) {
        const shown = result.errors.slice(0, 8);
        const extra = result.errors.length > shown.length ? `\n${result.errors.length - shown.length} more.` : "";
        setImportNotice({
          tone: "error",
          text: shown.length > 0 ? `${shown.join("\n")}${extra}` : "The CSV has no expenses to add."
        });
        return;
      }
      let added = 0;
      try {
        for (const payload of result.payloads) {
          await api.createExpense(payload);
          added += 1;
        }
      } catch (error) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["expenses"] }),
          queryClient.invalidateQueries({ queryKey: ["tags"] }),
          queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
          queryClient.invalidateQueries({ queryKey: ["budgets"] })
        ]);
        const message = error instanceof Error ? error.message : "Could not add an expense.";
        setImportNotice({
          tone: "error",
          text: added > 0 ? `Added ${added} expenses, then stopped: ${message} Filter by the csv tag to review them.` : message
        });
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["tags"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["budgets"] })
      ]);
      setImportNotice({
        tone: "ok",
        text: `Added ${added} ${added === 1 ? "expense" : "expenses"}. Each one is tagged csv. Use CSV imports to see them.`
      });
    } catch (error) {
      setImportNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not read the CSV." });
    } finally {
      setImporting(false);
    }
  };

  const armDownload = (anchor: HTMLAnchorElement) => {
    try {
      const csv = expensesToCsv(rows, categories.data ?? [], paymentSources.data ?? []);
      const url = csvObjectUrl(csv);
      anchor.href = url;
      anchor.download = csvFilename;
      setCsvUrl(url);
      setDownloadError("");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      anchor.removeAttribute("href");
      setDownloadError(error instanceof Error ? error.message : "Could not download the CSV.");
    }
  };

  const shareCsv = async () => {
    setDownloadError("");
    try {
      const csv = expensesToCsv(rows, categories.data ?? [], paymentSources.data ?? []);
      await shareTextFile(csvFilename, csv);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "Could not download the CSV.");
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-fern">Review</p>
          <h1 className="page-title">Expenses</h1>
        </div>
        <MonthField className="h-11 w-[9.5rem] text-sm" value={month} onChange={selectMonth} />
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DateField label="From date" placeholder="From" value={dateFrom} onChange={setDateFrom} />
          <DateField label="To date" placeholder="To" value={dateTo} onChange={setDateTo} />
          <MultiSelect
            label="Category"
            placeholder="All categories"
            options={(categories.data ?? []).map((category) => ({ id: category.id, name: category.name }))}
            value={categoryIDs}
            onChange={(ids) => {
              setCategoryIDs(ids);
              const allowed = new Set(ids);
              setSubcategoryIDs((current) => current.filter((id) => {
                const parent = (categories.data ?? []).find((category) => (category.subcategories ?? []).some((subcategory) => subcategory.id === id));
                return ids.length === 0 || Boolean(parent && allowed.has(parent.id));
              }));
            }}
          />
          <MultiSelect
            label="Subcategory"
            placeholder="All subcategories"
            options={(categoryIDs.length ? (categories.data ?? []).filter((category) => categoryIDs.includes(category.id)) : (categories.data ?? []))
              .flatMap((category) => (category.subcategories ?? []).map((subcategory) => ({ id: subcategory.id, name: subcategory.name, group: category.name })))}
            value={subcategoryIDs}
            onChange={setSubcategoryIDs}
          />
          <MultiSelect
            label="Payment"
            placeholder="All payments"
            options={(paymentSources.data ?? []).map((source) => ({ id: source.id, name: source.name }))}
            value={paymentSourceIDs}
            onChange={setPaymentSourceIDs}
          />
          <Button
            variant="secondary"
            type="button"
            onClick={() => setTags(tags.length === 1 && tags[0].toLowerCase() === csvImportTag ? [] : [csvImportTag])}
          >
            CSV imports
          </Button>
          <Button
            variant="secondary"
            disabled={!hasFilters}
            onClick={() => {
              setSearch("");
              setDateFrom("");
              setDateTo("");
              setCategoryIDs([]);
              setSubcategoryIDs([]);
              setPaymentSourceIDs([]);
              setTags([]);
            }}
          >
            <FilterX className="h-5 w-5" />
            Clear
          </Button>
        </div>
        <TagInput value={tags} onChange={setTags} placeholder="Filter by tags, such as csv" />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold">Filtered results</h2>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <a
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50"
              href={sampleUrl || undefined}
              download="pennywise-sample.csv"
              onClick={(event) => {
                if (!sampleUrl) event.preventDefault();
              }}
            >
              <Download className="h-5 w-5" />
              Sample CSV
            </a>
            <Button className="w-full sm:w-auto" variant="secondary" type="button" disabled={uploadDisabled} onClick={() => uploadRef.current?.click()}>
              <FileUp className="h-5 w-5" />
              {importing ? "Uploading" : "Upload CSV"}
            </Button>
            <input
              ref={uploadRef}
              className="hidden"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadCsv(file);
              }}
            />
          <a
            className={cn(
              "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-stone-50 sm:w-auto dark:border-stone-700 dark:bg-stone-900 dark:text-stone-50",
              downloadDisabled && "pointer-events-none opacity-60"
            )}
            href={downloadDisabled ? undefined : csvUrl || undefined}
            download={csvFilename}
            onPointerDown={(event) => {
              if (event.button !== 0 || downloadDisabled) return;
              armDownload(event.currentTarget);
            }}
            onKeyDown={(event) => {
              if (downloadDisabled || (event.key !== "Enter" && event.key !== " ")) return;
              armDownload(event.currentTarget);
            }}
            onClick={(event) => {
              if (downloadDisabled || !event.currentTarget.hasAttribute("href")) {
                event.preventDefault();
                return;
              }
              if (!prefersShareSheet()) return;
              event.preventDefault();
              void shareCsv();
            }}
          >
            <Download className="h-5 w-5" />
            Download CSV
          </a>
          </div>
        </div>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Sample CSV lists every category, subcategory, and tag. Fill Date, Merchant, Payment source, and Amount to add a row. Upload only adds expenses, and each one is tagged csv.
        </p>
        {importNotice && (
          <p className={cn("whitespace-pre-line rounded-xl p-3 text-sm font-semibold", importNotice.tone === "ok" ? "bg-fern/10 text-fern" : "bg-coral/10 text-coral")}>
            {importNotice.text}
          </p>
        )}
        {downloadError && <p className="rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{downloadError}</p>}
        <div className="grid gap-3 sm:grid-cols-3">
          <ReportStat label="Total spend" value={formatMoney(filteredTotal, currency)} loading={expenses.isLoading} />
          <ReportStat label="Transactions" value={String(rows.length)} loading={expenses.isLoading} />
          <ReportStat label="Average" value={formatMoney(average, currency)} loading={expenses.isLoading} />
        </div>
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
