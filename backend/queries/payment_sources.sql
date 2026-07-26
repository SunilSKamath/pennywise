-- name: CreatePaymentSource :execresult
INSERT INTO payment_sources (name, type, currency_code) VALUES (?, ?, ?);

-- name: GetPaymentSourceByID :one
SELECT id, name, type, currency_code FROM payment_sources WHERE id = ? AND deleted_at IS NULL;

-- name: ListPaymentSources :many
SELECT id, name, type, currency_code FROM payment_sources WHERE deleted_at IS NULL ORDER BY name;

