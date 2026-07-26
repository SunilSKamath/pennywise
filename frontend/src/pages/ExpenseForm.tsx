import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Save } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/Button";
import { TagInput } from "../components/TagInput";
import { api, type Expense } from "../lib/api";
import { categoryLabel, todayInputValue } from "../lib/utils";

const expenseSchema = z.object({
  amount: z.coerce.number().positive("Please enter an amount."),
  category_id: z.coerce.number().positive("Please choose a category."),
  payment_source_id: z.coerce.number().positive("Please choose a payment source."),
  merchant: z.string().min(1, "Please enter a merchant."),
  notes: z.string().optional(),
  expense_date: z.string().min(1, "Please choose a date."),
  original_currency_code: z.string().min(3, "Please enter a currency.")
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

export function ExpenseForm({ expense }: { expense?: Expense }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = Boolean(expense);
  const [tags, setTags] = useState<string[]>([]);
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const paymentSources = useQuery({ queryKey: ["payment-sources"], queryFn: api.paymentSources });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: 0,
      category_id: 0,
      payment_source_id: 0,
      merchant: "",
      notes: "",
      expense_date: todayInputValue(),
      original_currency_code: "INR"
    }
  });

  useEffect(() => {
    if (!expense) return;
    form.reset({
      amount: expense.original_amount_minor / 100,
      category_id: expense.category_id,
      payment_source_id: expense.payment_source_id,
      merchant: expense.merchant,
      notes: expense.notes,
      expense_date: expense.expense_date.slice(0, 10),
      original_currency_code: expense.original_currency_code
    });
    setTags(expense.tags ?? []);
  }, [expense, form]);

  const saveExpense = useMutation({
    mutationFn: (values: ExpenseFormValues) => {
      const payload = {
        original_amount_minor: Math.round(values.amount * 100),
        original_currency_code: values.original_currency_code.toUpperCase(),
        category_id: values.category_id,
        payment_source_id: values.payment_source_id,
        merchant: values.merchant,
        notes: values.notes,
        expense_date: values.expense_date,
        tags
      };
      return isEditing && expense ? api.updateExpense(expense.id, payload) : api.createExpense(payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["expenses"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] })
      ]);
      navigate(isEditing ? "/expenses" : "/");
    }
  });

  const errors = form.formState.errors;
  const expenseDate = form.watch("expense_date");

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-sm font-semibold text-fern">{isEditing ? "Update entry" : "Quick entry"}</p>
        <h1 className="page-title">{isEditing ? "Edit Expense" : "Add Expense"}</h1>
      </header>

      <form className="panel space-y-4 p-4 sm:p-6" onSubmit={form.handleSubmit((values) => saveExpense.mutate(values))}>
        <Field label="Amount" error={errors.amount?.message}>
          <input className="control w-full text-3xl font-extrabold" inputMode="decimal" type="number" step="0.01" {...form.register("amount")} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" error={errors.category_id?.message}>
            <select className="control w-full" {...form.register("category_id")}>
              <option value={0}>Choose category</option>
              {(categories.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>{categoryLabel(category)}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment Source" error={errors.payment_source_id?.message}>
            <select className="control w-full" {...form.register("payment_source_id")}>
              <option value={0}>Choose payment</option>
              {(paymentSources.data ?? []).map((source) => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Merchant" error={errors.merchant?.message}>
          <input className="control w-full" {...form.register("merchant")} placeholder="Coffee, groceries, taxi" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" error={errors.expense_date?.message}>
            <div className="relative h-12 w-full overflow-hidden rounded-xl">
              <input
                className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                type="date"
                aria-label="Date"
                {...form.register("expense_date")}
              />
              <div className="control flex w-full items-center justify-between gap-3 peer-focus:border-fern peer-focus:ring-4 peer-focus:ring-fern/15">
                <span className="min-w-0 flex-1 truncate text-center">{formatInputDate(expenseDate)}</span>
                <CalendarDays className="h-5 w-5 shrink-0 text-stone-400" aria-hidden="true" />
              </div>
            </div>
          </Field>
          <Field label="Currency" error={errors.original_currency_code?.message}>
            <input className="control w-full uppercase" maxLength={3} {...form.register("original_currency_code")} />
          </Field>
        </div>

        <Field label="Notes" error={errors.notes?.message}>
          <textarea className="control min-h-24 w-full py-3" {...form.register("notes")} placeholder="Comments about this expense" />
        </Field>

        <Field label="Tags">
          <TagInput value={tags} onChange={setTags} placeholder="Trip, recurring, reimbursable" />
        </Field>

        {saveExpense.error && <p className="rounded-xl bg-coral/10 p-3 text-sm font-semibold text-coral">{saveExpense.error.message}</p>}

        <Button className="h-14 w-full text-base" disabled={saveExpense.isPending}>
          <Save className="h-5 w-5" />
          {saveExpense.isPending ? "Saving" : isEditing ? "Update Expense" : "Save Expense"}
        </Button>
      </form>
    </div>
  );
}

function formatInputDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "Choose date";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-stone-600 dark:text-stone-300">{label}</span>
      {children}
      {error && <span className="block text-sm font-semibold text-coral">{error}</span>}
    </label>
  );
}
