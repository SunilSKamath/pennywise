import { CirclePlus } from "lucide-react";
import { Link } from "react-router-dom";

export function EmptyState({ title = "No Expenses Yet", action = true }: { title?: string; action?: boolean }) {
  return (
    <div className="panel flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-sky text-fern">
        <CirclePlus className="h-6 w-6" />
      </div>
      <h2 className="text-lg font-bold text-ink dark:text-stone-50">{title}</h2>
      <p className="mt-1 max-w-64 text-sm text-stone-500 dark:text-stone-400">Add your first expense and Pennywise will start organizing the month.</p>
      {action && (
        <Link className="mt-5 inline-flex h-12 items-center justify-center rounded-xl bg-fern px-4 text-sm font-semibold text-white shadow-soft" to="/add">
          Add Your First Expense
        </Link>
      )}
    </div>
  );
}
