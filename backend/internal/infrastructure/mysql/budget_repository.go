package mysql

import (
	"context"
	"database/sql"

	domain "github.com/creation/pennywise/backend/internal/domain/budget"
)

type BudgetRepository struct {
	db *sql.DB
}

func NewBudgetRepository(db *sql.DB) *BudgetRepository {
	return &BudgetRepository{db: db}
}

func (r *BudgetRepository) Upsert(ctx context.Context, budget *domain.Budget) error {
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO budgets (household_id, category_id, month, amount_minor, currency_code)
		VALUES (?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			amount_minor = VALUES(amount_minor),
			currency_code = VALUES(currency_code),
			deleted_at = NULL,
			updated_at = CURRENT_TIMESTAMP
	`, budget.HouseholdID, budget.CategoryID, budget.Month, budget.AmountMinor, budget.CurrencyCode)
	if err != nil {
		return err
	}
	if budget.ID == 0 {
		id, err := result.LastInsertId()
		if err != nil {
			return err
		}
		if id > 0 {
			budget.ID = uint64(id)
		}
	}
	if budget.ID == 0 {
		existing, err := r.getByCategoryMonth(ctx, budget.HouseholdID, budget.CategoryID, budget.Month)
		if err != nil {
			return err
		}
		budget.ID = existing.ID
		budget.CreatedAt = existing.CreatedAt
		budget.UpdatedAt = existing.UpdatedAt
	}
	return nil
}

func (r *BudgetRepository) getByCategoryMonth(ctx context.Context, householdID, categoryID uint64, month string) (*domain.Budget, error) {
	var budget domain.Budget
	err := r.db.QueryRowContext(ctx, `
		SELECT id, household_id, category_id, month, amount_minor, currency_code, created_at, updated_at
		FROM budgets
		WHERE household_id = ? AND category_id = ? AND month = ? AND deleted_at IS NULL
	`, householdID, categoryID, month).Scan(
		&budget.ID, &budget.HouseholdID, &budget.CategoryID, &budget.Month,
		&budget.AmountMinor, &budget.CurrencyCode, &budget.CreatedAt, &budget.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &budget, nil
}

func (r *BudgetRepository) Delete(ctx context.Context, id uint64, householdID uint64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE budgets SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = ? AND household_id = ? AND deleted_at IS NULL
	`, id, householdID)
	return err
}

func (r *BudgetRepository) GetByID(ctx context.Context, id uint64, householdID uint64) (*domain.Budget, error) {
	var budget domain.Budget
	err := r.db.QueryRowContext(ctx, `
		SELECT id, household_id, category_id, month, amount_minor, currency_code, created_at, updated_at
		FROM budgets
		WHERE id = ? AND household_id = ? AND deleted_at IS NULL
	`, id, householdID).Scan(
		&budget.ID, &budget.HouseholdID, &budget.CategoryID, &budget.Month,
		&budget.AmountMinor, &budget.CurrencyCode, &budget.CreatedAt, &budget.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &budget, nil
}

func (r *BudgetRepository) ListByMonth(ctx context.Context, householdID uint64, month string) ([]domain.Budget, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, household_id, category_id, month, amount_minor, currency_code, created_at, updated_at
		FROM budgets
		WHERE household_id = ? AND month = ? AND deleted_at IS NULL
		ORDER BY category_id
	`, householdID, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	budgets := []domain.Budget{}
	for rows.Next() {
		var budget domain.Budget
		if err := rows.Scan(
			&budget.ID, &budget.HouseholdID, &budget.CategoryID, &budget.Month,
			&budget.AmountMinor, &budget.CurrencyCode, &budget.CreatedAt, &budget.UpdatedAt,
		); err != nil {
			return nil, err
		}
		budgets = append(budgets, budget)
	}
	return budgets, rows.Err()
}
