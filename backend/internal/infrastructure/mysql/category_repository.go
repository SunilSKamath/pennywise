package mysql

import (
	"context"
	"database/sql"
	"errors"
	"strings"

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
	if category.Subcategories == nil {
		category.Subcategories = []domain.Subcategory{}
	}
	return nil
}

func (r *CategoryRepository) UpdateEmoji(ctx context.Context, id uint64, emoji string) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE categories SET emoji = ? WHERE id = ? AND deleted_at IS NULL
	`, emoji, id)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return sql.ErrNoRows
	}
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
	subcategories, err := r.subcategoriesByCategory(ctx, []uint64{category.ID})
	if err != nil {
		return nil, err
	}
	category.Subcategories = subcategories[category.ID]
	if category.Subcategories == nil {
		category.Subcategories = []domain.Subcategory{}
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
	ids := []uint64{}
	for rows.Next() {
		var category domain.Category
		if err := rows.Scan(&category.ID, &category.Name, &category.Emoji); err != nil {
			return nil, err
		}
		category.Subcategories = []domain.Subcategory{}
		categories = append(categories, category)
		ids = append(ids, category.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	grouped, err := r.subcategoriesByCategory(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range categories {
		if children := grouped[categories[i].ID]; children != nil {
			categories[i].Subcategories = children
		}
	}
	return categories, nil
}

func (r *CategoryRepository) GetSubcategory(ctx context.Context, id uint64) (*domain.Subcategory, error) {
	var subcategory domain.Subcategory
	err := r.db.QueryRowContext(ctx, `
		SELECT id, category_id, name, deleted_at IS NOT NULL
		FROM category_subcategories
		WHERE id = ?
	`, id).Scan(&subcategory.ID, &subcategory.CategoryID, &subcategory.Name, &subcategory.Deleted)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("subcategory not found")
		}
		return nil, err
	}
	return &subcategory, nil
}

func (r *CategoryRepository) CreateSubcategory(ctx context.Context, subcategory *domain.Subcategory) error {
	var existing uint64
	err := r.db.QueryRowContext(ctx, `
		SELECT id
		FROM category_subcategories
		WHERE category_id = ? AND name = ? AND deleted_at IS NULL
	`, subcategory.CategoryID, subcategory.Name).Scan(&existing)
	if err == nil {
		return errors.New("subcategory already exists")
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO category_subcategories (category_id, name)
		VALUES (?, ?)
	`, subcategory.CategoryID, subcategory.Name)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	subcategory.ID = uint64(id)
	return nil
}

func (r *CategoryRepository) DeleteSubcategory(ctx context.Context, categoryID uint64, subcategoryID uint64) error {
	result, err := r.db.ExecContext(ctx, `
		UPDATE category_subcategories
		SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = ? AND category_id = ? AND deleted_at IS NULL
	`, subcategoryID, categoryID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return errors.New("subcategory not found")
	}
	return nil
}

func (r *CategoryRepository) subcategoriesByCategory(ctx context.Context, categoryIDs []uint64) (map[uint64][]domain.Subcategory, error) {
	grouped := map[uint64][]domain.Subcategory{}
	if len(categoryIDs) == 0 {
		return grouped, nil
	}
	query := `
		SELECT id, category_id, name, deleted_at IS NOT NULL
		FROM category_subcategories
		WHERE category_id IN (` + strings.Join(repeatPlaceholders(len(categoryIDs)), ",") + `)
			AND (
				deleted_at IS NULL
				OR id IN (
					SELECT subcategory_id
					FROM expenses
					WHERE deleted_at IS NULL AND subcategory_id IS NOT NULL
				)
			)
		ORDER BY name
	`
	args := make([]any, len(categoryIDs))
	for i, id := range categoryIDs {
		args[i] = id
	}
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var subcategory domain.Subcategory
		if err := rows.Scan(&subcategory.ID, &subcategory.CategoryID, &subcategory.Name, &subcategory.Deleted); err != nil {
			return nil, err
		}
		grouped[subcategory.CategoryID] = append(grouped[subcategory.CategoryID], subcategory)
	}
	return grouped, rows.Err()
}

func repeatPlaceholders(count int) []string {
	marks := make([]string, count)
	for i := range marks {
		marks[i] = "?"
	}
	return marks
}
