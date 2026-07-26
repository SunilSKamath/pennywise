-- name: CreateExpense :execresult
INSERT INTO expenses (
  original_amount_minor,
  original_currency_code,
  converted_amount_minor,
  converted_currency_code,
  exchange_rate,
  category_id,
  payment_source_id,
  merchant,
  notes,
  expense_date,
  created_by,
  metadata_json
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetExpenseByID :one
SELECT id, original_amount_minor, original_currency_code, converted_amount_minor,
  converted_currency_code, exchange_rate, category_id, payment_source_id,
  merchant, notes, expense_date, created_by, COALESCE(metadata_json, ''),
  created_at, updated_at
FROM expenses
WHERE id = ? AND created_by = ? AND deleted_at IS NULL;

