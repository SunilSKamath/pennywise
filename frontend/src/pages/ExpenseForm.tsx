import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "../components/Button";
import { DateField } from "../components/DateField";
import { SelectMenu } from "../components/SelectMenu";
import { TagInput } from "../components/TagInput";
import { api, type Expense } from "../lib/api";
import { categoryLabel, todayInputValue } from "../lib/utils";

const expenseSchema = z.object({
  amount: z.coerce.number().positive("Please enter an amount."),
  category_id: z.coerce.number().positive("Please choose a category."),
  subcategory_id: z.coerce.number().min(0),
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
      subcategory_id: 0,
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
      subcategory_id: expense.subcategory_id ?? 0,
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
        subcategory_id: values.subcategory_id > 0 ? values.subcategory_id : null,
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
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["tags"] })
      ]);
      navigate(isEditing ? "/expenses" : "/");
    }
  });

  const errors = form.formState.errors;
  const expenseDate = form.watch("expense_date");
  const categoryID = Number(form.watch("category_id"));
  const subcategoryID = Number(form.watch("subcategory_id"));
  const selectedCategory = (categories.data ?? []).find((category) => category.id === categoryID);
  const activeSubcategories = (selectedCategory?.subcategories ?? []).filter((subcategory) => !subcategory.deleted);
  const subcategoryOptions = [...activeSubcategories];
  if (
    expense?.subcategory_id &&
    expense.category_id === categoryID &&
    !subcategoryOptions.some((subcategory) => subcategory.id === expense.subcategory_id)
  ) {
    subcategoryOptions.push({ id: expense.subcategory_id, name: expense.subcategory_name || "Subcategory" });
  }
  const allowedSubcategoryIDs = subcategoryOptions.map((subcategory) => subcategory.id).join(",");

  useEffect(() => {
    if (!categories.data) return;
    const allowed = allowedSubcategoryIDs.split(",").filter(Boolean);
    if (subcategoryID > 0 && !allowed.includes(String(subcategoryID))) {
      form.setValue("subcategory_id", 0);
    }
  }, [allowedSubcategoryIDs, categories.data, form, subcategoryID]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <p className="text-sm font-semibold text-fern">{isEditing ? "Update entry" : "Quick entry"}</p>
        <h1 className="page-title">{isEditing ? "Edit Expense" : "Add Expense"}</h1>
      </header>

      <form
        className="panel space-y-4 p-4 sm:p-6"
        onSubmit={form.handleSubmit((values) => {
          const category = (categories.data ?? []).find((item) => item.id === Number(values.category_id));
          const active = (category?.subcategories ?? []).filter((subcategory) => !subcategory.deleted);
          if (!isEditing && active.length > 0 && Number(values.subcategory_id) <= 0) {
            form.setError("subcategory_id", { message: "Please choose a subcategory." });
            return;
          }
          saveExpense.mutate(values);
        })}
      >
        <Field label="Amount" error={errors.amount?.message}>
          <input className="control w-full text-3xl font-extrabold" inputMode="decimal" type="number" step="0.01" {...form.register("amount")} autoFocus />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field as="div" label="Category" error={errors.category_id?.message}>
            <Controller
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <SelectMenu
                  label="Category"
                  placeholder="Choose category"
                  options={(categories.data ?? []).map((category) => ({ id: category.id, name: categoryLabel(category) }))}
                  value={Number(field.value)}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
          {subcategoryOptions.length > 0 && (
            <Field as="div" label="Subcategory" error={errors.subcategory_id?.message}>
              <Controller
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <SelectMenu
                    label="Subcategory"
                    placeholder="Choose subcategory"
                    options={subcategoryOptions.map((subcategory) => ({ id: subcategory.id, name: subcategory.name }))}
                    value={Number(field.value)}
                    onChange={field.onChange}
                  />
                )}
              />
            </Field>
          )}
          <Field as="div" label="Payment Source" error={errors.payment_source_id?.message}>
            <Controller
              control={form.control}
              name="payment_source_id"
              render={({ field }) => (
                <SelectMenu
                  label="Payment Source"
                  placeholder="Choose payment"
                  options={(paymentSources.data ?? []).map((source) => ({ id: source.id, name: source.name }))}
                  value={Number(field.value)}
                  onChange={field.onChange}
                />
              )}
            />
          </Field>
        </div>

        <Field label="Merchant" error={errors.merchant?.message}>
          <input className="control w-full" {...form.register("merchant")} placeholder="Coffee, groceries, taxi" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field as="div" label="Date" error={errors.expense_date?.message}>
            <DateField value={expenseDate} onChange={(value) => form.setValue("expense_date", value, { shouldValidate: true })} />
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

function Field({ as = "label", label, error, children }: { as?: "label" | "div"; label: string; error?: string; children: ReactNode }) {
  const Wrapper = as;
  return (
    <Wrapper className="block space-y-2">
      <span className="block text-sm font-bold text-stone-600 dark:text-stone-300">{label}</span>
      {children}
      {error && <span className="block text-sm font-semibold text-coral">{error}</span>}
    </Wrapper>
  );
}
