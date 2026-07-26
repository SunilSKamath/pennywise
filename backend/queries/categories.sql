-- name: CreateCategory :execresult
INSERT INTO categories (name) VALUES (?);

-- name: GetCategoryByID :one
SELECT id, name FROM categories WHERE id = ? AND deleted_at IS NULL;

-- name: ListCategories :many
SELECT id, name FROM categories WHERE deleted_at IS NULL ORDER BY name;

