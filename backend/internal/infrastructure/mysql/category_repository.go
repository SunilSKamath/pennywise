package mysql

import (
	"context"
	"database/sql"

	domain "github.com/creation/pennywise/backend/internal/domain/category"
)

type CategoryRepository struct {
	db *sql.DB
}

func NewCategoryRepository(db *sql.DB) *CategoryRepository {
	return &CategoryRepository{db: db}
}

func (r *CategoryRepository) Create(ctx context.Context, category *domain.Category) error {
	result, err := r.db.ExecContext(ctx, `INSERT INTO categories (name, emoji) VALUES (?, ?)`, category.Name, category.Emoji)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	category.ID = uint64(id)
	return nil
}

func (r *CategoryRepository) GetByID(ctx context.Context, id uint64) (*domain.Category, error) {
	var category domain.Category
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, emoji
		FROM categories
		WHERE id = ? AND deleted_at IS NULL
	`, id).Scan(&category.ID, &category.Name, &category.Emoji)
	if err != nil {
		return nil, err
	}
	return &category, nil
}

func (r *CategoryRepository) List(ctx context.Context) ([]domain.Category, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, emoji
		FROM categories
		WHERE deleted_at IS NULL
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := []domain.Category{}
	for rows.Next() {
		var category domain.Category
		if err := rows.Scan(&category.ID, &category.Name, &category.Emoji); err != nil {
			return nil, err
		}
		categories = append(categories, category)
	}
	return categories, rows.Err()
}
