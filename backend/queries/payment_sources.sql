-- name: CreatePaymentSource :execresult
INSERT INTO payment_sources (household_id, name, type, currency_code) VALUES (?, ?, ?, ?);

-- name: GetPaymentSourceByID :one
SELECT id, household_id, name, type, currency_code
FROM payment_sources
WHERE id = ? AND household_id = ? AND deleted_at IS NULL;

-- name: ListPaymentSources :many
SELECT id, household_id, name, type, currency_code
FROM payment_sources
WHERE household_id = ? AND deleted_at IS NULL
ORDER BY name;
