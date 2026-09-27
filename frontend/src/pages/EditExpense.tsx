import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { ExpenseForm } from "./ExpenseForm";

export function EditExpense() {
  const { id } = useParams();
  const expenseID = Number(id);
  const expense = useQuery({
    queryKey: ["expenses", expenseID],
    queryFn: () => api.expense(expenseID),
    enabled: Number.isFinite(expenseID) && expenseID > 0,
    retry: false
  });

  if (expense.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (expense.isError || !expense.data) {
    return <EmptyState title="Expense Not Found" action={false} />;
  }

  return <ExpenseForm expense={expense.data} />;
}
