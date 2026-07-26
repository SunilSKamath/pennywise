import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilterX, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ExpenseRow } from "../components/ExpenseRow";
import { Skeleton } from "../components/Skeleton";
import { TagInput } from "../components/TagInput";
import { api, type Expense, type ExpenseFilters } from "../lib/api";

export function Expenses() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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

  const deleteExpense = useMutation({
    mutationFn: api.deleteExpense,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
    }
  });

  const hasFilters = Boolean(search || dateFrom || dateTo || categoryID || paymentSourceID || tags.length > 0);

  const handleDelete = (expense: Expense) => {
    const label = expense.merchant || "this expense";
    if (!window.confirm(`Delete ${label}?`)) return;
    deleteExpense.mutate(expense.id);
  };

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm font-semibold text-fern">Review</p>
        <h1 className="page-title">Expenses</h1>
      </header>

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

      {deleteExpense.error && <p className="rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{deleteExpense.error.message}</p>}

      {expenses.isLoading ? (
        <div className="panel p-4">
          <Skeleton className="mb-3 h-16" />
          <Skeleton className="mb-3 h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (expenses.data ?? []).length === 0 ? (
        <EmptyState title={hasFilters ? "No Matching Expenses" : "No Expenses Yet"} />
      ) : (
        <div className="panel overflow-hidden px-4">
          {(expenses.data ?? []).map((expense) => (
            <ExpenseRow
              key={expense.id}
              expense={expense}
              categories={categories.data ?? []}
              paymentSources={paymentSources.data ?? []}
              editable
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
