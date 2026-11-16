-- name: CreateCategory :execresult
INSERT INTO categories (household_id, name, emoji) VALUES (?, ?, ?);

-- name: GetCategoryByID :one
SELECT id, household_id, name, emoji, yearly_budget_enabled
FROM categories
WHERE id = ? AND household_id = ? AND deleted_at IS NULL;

-- name: ListCategories :many
SELECT id, household_id, name, emoji, yearly_budget_enabled
FROM categories
WHERE household_id = ? AND deleted_at IS NULL
ORDER BY name;
