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

const budgetColumns = `
	b.id, b.household_id, b.category_id, b.subcategory_id, COALESCE(sc.name, ''),
	b.month, b.amount_minor, b.currency_code, b.created_at, b.updated_at
`

const budgetFrom = `
	FROM budgets b
	LEFT JOIN category_subcategories sc ON sc.id = b.subcategory_id
`

func (r *BudgetRepository) Upsert(ctx context.Context, budget *domain.Budget) error {
	var subcategoryID any
	if budget.SubcategoryID != nil {
		subcategoryID = *budget.SubcategoryID
	}
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO budgets (household_id, category_id, subcategory_id, month, amount_minor, currency_code)
		VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			amount_minor = VALUES(amount_minor),
			currency_code = VALUES(currency_code),
			deleted_at = NULL,
			updated_at = CURRENT_TIMESTAMP
	`, budget.HouseholdID, budget.CategoryID, subcategoryID, budget.Month, budget.AmountMinor, budget.CurrencyCode)
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
		existing, err := r.getByScope(ctx, budget.HouseholdID, budget.CategoryID, budget.SubcategoryID, budget.Month)
		if err != nil {
			return err
		}
		budget.ID = existing.ID
		budget.CreatedAt = existing.CreatedAt
		budget.UpdatedAt = existing.UpdatedAt
		budget.SubcategoryName = existing.SubcategoryName
	}
	return nil
}

func (r *BudgetRepository) getByScope(ctx context.Context, householdID, categoryID uint64, subcategoryID *uint64, month string) (*domain.Budget, error) {
	var scope any
	if subcategoryID != nil {
		scope = *subcategoryID
	}
	row := r.db.QueryRowContext(ctx, `
		SELECT `+budgetColumns+budgetFrom+`
		WHERE b.household_id = ? AND b.category_id = ? AND b.month = ? AND b.deleted_at IS NULL
			AND b.subcategory_id <=> ?
	`, householdID, categoryID, month, scope)
	return scanBudget(row)
}

func (r *BudgetRepository) Delete(ctx context.Context, id uint64, householdID uint64) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE budgets SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = ? AND household_id = ? AND deleted_at IS NULL
	`, id, householdID)
	return err
}

func (r *BudgetRepository) GetByID(ctx context.Context, id uint64, householdID uint64) (*domain.Budget, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT `+budgetColumns+budgetFrom+`
		WHERE b.id = ? AND b.household_id = ? AND b.deleted_at IS NULL
	`, id, householdID)
	return scanBudget(row)
}

func (r *BudgetRepository) ListByMonth(ctx context.Context, householdID uint64, month string) ([]domain.Budget, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+budgetColumns+budgetFrom+`
		WHERE b.household_id = ? AND b.month = ? AND b.deleted_at IS NULL
		ORDER BY b.category_id, b.subcategory_id
	`, householdID, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	budgets := []domain.Budget{}
	for rows.Next() {
		budget, err := scanBudget(rows)
		if err != nil {
			return nil, err
		}
		budgets = append(budgets, *budget)
	}
	return budgets, rows.Err()
}

type budgetScanner interface {
	Scan(dest ...any) error
}

func scanBudget(row budgetScanner) (*domain.Budget, error) {
	var budget domain.Budget
	var subcategoryID sql.NullInt64
	err := row.Scan(
		&budget.ID, &budget.HouseholdID, &budget.CategoryID, &subcategoryID, &budget.SubcategoryName,
		&budget.Month, &budget.AmountMinor, &budget.CurrencyCode, &budget.CreatedAt, &budget.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if subcategoryID.Valid {
		id := uint64(subcategoryID.Int64)
		budget.SubcategoryID = &id
	}
	return &budget, nil
}
