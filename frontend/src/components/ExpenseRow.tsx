import { Pencil, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import type { Category, Expense, PaymentSource } from "../lib/api";
import { categoryEmoji, formatDate, formatMoney } from "../lib/utils";

export function ExpenseRow({
  expense,
  categories,
  paymentSources,
  editable = false,
  onDelete
}: {
  expense: Expense;
  categories: Category[];
  paymentSources: PaymentSource[];
  editable?: boolean;
  onDelete?: (expense: Expense) => void;
}) {
  const categoryRecord = categories.find((item) => item.id === expense.category_id);
  const category = categoryRecord?.name ?? "Uncategorized";
  const emoji = categoryEmoji(categoryRecord);
  const paymentSource = paymentSources.find((item) => item.id === expense.payment_source_id)?.name ?? "Payment";

  return (
    <div className="flex min-w-0 items-start gap-3 overflow-hidden border-b border-stone-100 px-1 py-4 last:border-0 dark:border-stone-800">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-oat text-xl dark:bg-stone-800" aria-hidden="true">
        {emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink dark:text-stone-50">{expense.merchant || category}</p>
            {expense.notes.trim() && (
              <p className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-300">{expense.notes}</p>
            )}
          </div>
          <p className="max-w-[8.5rem] truncate text-right font-bold sm:max-w-none">{formatMoney(expense.original_amount_minor, expense.original_currency_code)}</p>
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
          <span className="truncate">{category}</span>
          <span aria-hidden="true">/</span>
          <span className="truncate">{paymentSource}</span>
          <span aria-hidden="true">/</span>
          <span>{formatDate(expense.expense_date)}</span>
        </div>
        {expense.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {expense.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-oat px-2 py-1 text-xs font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {editable && (
        <div className="flex shrink-0 items-center gap-1">
          <Link
            className="grid h-10 w-10 place-items-center rounded-xl text-stone-500 transition hover:bg-stone-100 hover:text-fern dark:hover:bg-stone-800"
            to={`/expenses/${expense.id}/edit`}
            aria-label={`Edit ${expense.merchant || category}`}
          >
            <Pencil className="h-4 w-4" />
          </Link>
          {onDelete && (
            <button
              className="grid h-10 w-10 place-items-center rounded-xl text-stone-500 transition hover:bg-coral/10 hover:text-coral"
              type="button"
              aria-label={`Delete ${expense.merchant || category}`}
              onClick={() => onDelete(expense)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
