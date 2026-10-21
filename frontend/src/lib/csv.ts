import type { Category, Expense, PaymentSource } from "./api";

const headers = [
  "Date",
  "Merchant",
  "Category",
  "Subcategory",
  "Payment source",
  "Amount",
  "Currency",
  "Converted amount",
  "Converted currency",
  "Notes",
  "Tags"
];

function csvField(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvText(value: string | null | undefined) {
  const text = value ?? "";
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return csvField(safe);
}

function amount(minor: number) {
  return (minor / 100).toFixed(2);
}

export function expensesToCsv(expenses: Expense[], categories: Category[], paymentSources: PaymentSource[]) {
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const paymentNames = new Map(paymentSources.map((source) => [source.id, source.name]));
  const lines = expenses.map((expense) =>
    [
      csvField(expense.expense_date.slice(0, 10)),
      csvText(expense.merchant),
      csvText(categoryNames.get(expense.category_id) ?? ""),
      csvText(expense.subcategory_name),
      csvText(paymentNames.get(expense.payment_source_id) ?? ""),
      amount(expense.original_amount_minor),
      csvField(expense.original_currency_code),
      amount(expense.converted_amount_minor),
      csvField(expense.converted_currency_code),
      csvText(expense.notes),
      csvText((expense.tags ?? []).join("; "))
    ].join(",")
  );
  return [headers.join(","), ...lines].join("\r\n");
}

export function expenseCsvFilename(dateFrom: string, dateTo: string) {
  const from = dateFrom.trim();
  const to = dateTo.trim();
  if (!from && !to) return "pennywise-expenses.csv";
  return `pennywise-expenses-${from || "start"}-to-${to || "end"}.csv`;
}
