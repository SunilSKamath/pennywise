import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { Skeleton } from "../components/Skeleton";
import { api } from "../lib/api";
import { ExpenseForm } from "./ExpenseForm";

export function EditExpense() {
  const { id } = useParams();
  const expenseID = Number(id);
  const expenses = useQuery({ queryKey: ["expenses"], queryFn: () => api.expenses() });
  const expense = expenses.data?.find((item) => item.id === expenseID);

  if (expenses.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!expense) {
    return <EmptyState title="Expense Not Found" action={false} />;
  }

  return <ExpenseForm expense={expense} />;
}
