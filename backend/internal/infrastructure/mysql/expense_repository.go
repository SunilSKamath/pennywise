package mysql

import (
	"context"
	"database/sql"
	"strings"
	"time"

	domain "github.com/creation/pennywise/backend/internal/domain/expense"
	"github.com/shopspring/decimal"
)

type ExpenseRepository struct {
	db *sql.DB
}

func NewExpenseRepository(db *sql.DB) *ExpenseRepository {
	return &ExpenseRepository{db: db}
}

func (r *ExpenseRepository) Create(ctx context.Context, expense *domain.Expense) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	result, err := tx.ExecContext(ctx, `
		INSERT INTO expenses (
			household_id,
			original_amount_minor,
			original_currency_code,
			converted_amount_minor,
			converted_currency_code,
			exchange_rate,
			category_id,
			subcategory_id,
			payment_source_id,
			merchant,
			notes,
			expense_date,
			created_by,
			metadata_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULLIF(?, ''))
	`,
		expense.HouseholdID,
		expense.OriginalAmountMinor,
		expense.OriginalCurrencyCode,
		expense.ConvertedAmountMinor,
		expense.ConvertedCurrencyCode,
		expense.ExchangeRate.StringFixed(10),
		expense.CategoryID,
		subcategoryValue(expense.SubcategoryID),
		expense.PaymentSourceID,
		expense.Merchant,
		expense.Notes,
		expense.ExpenseDate,
		expense.CreatedBy,
		expense.MetadataJSON,
	)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	expense.ID = uint64(id)
	if err := r.syncExpenseTags(ctx, tx, expense.ID, expense.HouseholdID, expense.Tags); err != nil {
		return err
	}
	if err := r.deleteUnusedTags(ctx, tx, expense.HouseholdID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ExpenseRepository) Update(ctx context.Context, expense domain.Expense) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `
		UPDATE expenses
		SET original_amount_minor = ?,
			original_currency_code = ?,
			converted_amount_minor = ?,
			converted_currency_code = ?,
			exchange_rate = ?,
			category_id = ?,
			subcategory_id = ?,
			payment_source_id = ?,
			merchant = ?,
			notes = ?,
			expense_date = ?,
			metadata_json = NULLIF(?, '')
		WHERE id = ? AND household_id = ? AND deleted_at IS NULL
	`,
		expense.OriginalAmountMinor,
		expense.OriginalCurrencyCode,
		expense.ConvertedAmountMinor,
		expense.ConvertedCurrencyCode,
		expense.ExchangeRate.StringFixed(10),
		expense.CategoryID,
		subcategoryValue(expense.SubcategoryID),
		expense.PaymentSourceID,
		expense.Merchant,
		expense.Notes,
		expense.ExpenseDate,
		expense.MetadataJSON,
		expense.ID,
		expense.HouseholdID,
	)
	if err != nil {
		return err
	}
	if err := r.syncExpenseTags(ctx, tx, expense.ID, expense.HouseholdID, expense.Tags); err != nil {
		return err
	}
	if err := r.deleteUnusedTags(ctx, tx, expense.HouseholdID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ExpenseRepository) Delete(ctx context.Context, id uint64, householdID uint64) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `
		UPDATE expenses
		SET deleted_at = CURRENT_TIMESTAMP
		WHERE id = ? AND household_id = ? AND deleted_at IS NULL
	`, id, householdID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM expense_tags WHERE expense_id = ?`, id); err != nil {
		return err
	}
	if err := r.deleteUnusedTags(ctx, tx, householdID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *ExpenseRepository) GetByID(ctx context.Context, id uint64, householdID uint64) (*domain.Expense, error) {
	row := r.db.QueryRowContext(ctx, baseExpenseSelect()+`
		WHERE e.id = ? AND e.household_id = ? AND e.deleted_at IS NULL
	`, id, householdID)
	expense, err := scanExpense(row)
	if err != nil {
		return nil, err
	}
	if err := r.attachExpenseTags(ctx, expense); err != nil {
		return nil, err
	}
	return expense, nil
}

func (r *ExpenseRepository) List(ctx context.Context, filter domain.Filter) ([]domain.Expense, error) {
	where := []string{"e.deleted_at IS NULL"}
	args := []any{}
	if filter.HouseholdID != nil {
		where = append(where, "e.household_id = ?")
		args = append(args, *filter.HouseholdID)
	}
	if filter.DateFrom != nil {
		where = append(where, "e.expense_date >= ?")
		args = append(args, *filter.DateFrom)
	}
	if filter.DateTo != nil {
		where = append(where, "e.expense_date < ?")
		args = append(args, *filter.DateTo)
	}
	where, args = appendIDFilter(where, args, "e.category_id", filter.CategoryIDs)
	where, args = appendIDFilter(where, args, "e.subcategory_id", filter.SubcategoryIDs)
	where, args = appendIDFilter(where, args, "e.payment_source_id", filter.PaymentSourceIDs)
	for _, tag := range normalizeTagNames(filter.Tags) {
		where = append(where, `EXISTS (
			SELECT 1
			FROM expense_tags et
			JOIN tags t ON t.id = et.tag_id
			WHERE et.expense_id = e.id
				AND t.household_id = e.household_id
				AND t.normalized_name = ?
		)`)
		args = append(args, normalizedTagName(tag))
	}
	if strings.TrimSpace(filter.Search) != "" {
		search := "%" + strings.ToLower(strings.TrimSpace(filter.Search)) + "%"
		where = append(where, `(
			LOWER(e.merchant) LIKE ?
			OR LOWER(e.notes) LIKE ?
			OR LOWER(e.original_currency_code) LIKE ?
			OR LOWER(e.converted_currency_code) LIKE ?
			OR LOWER(DATE_FORMAT(e.expense_date, '%Y-%m-%d')) LIKE ?
			OR CAST(e.original_amount_minor AS CHAR) LIKE ?
			OR CAST(e.converted_amount_minor AS CHAR) LIKE ?
			OR EXISTS (
				SELECT 1 FROM expense_tags et
				JOIN tags t ON t.id = et.tag_id
				WHERE et.expense_id = e.id AND LOWER(t.name) LIKE ?
			)
			OR EXISTS (
				SELECT 1 FROM categories c
				WHERE c.id = e.category_id AND LOWER(c.name) LIKE ?
			)
			OR EXISTS (
				SELECT 1 FROM payment_sources ps
				WHERE ps.id = e.payment_source_id
					AND (
						LOWER(ps.name) LIKE ?
						OR LOWER(ps.type) LIKE ?
						OR LOWER(ps.currency_code) LIKE ?
					)
			)
		)`)
		args = append(args, search, search, search, search, search, search, search, search, search, search, search, search)
	}
	limit := filter.Limit
	if limit == 0 || limit > 200 {
		limit = 50
	}
	query := baseExpenseSelect() + " WHERE " + strings.Join(where, " AND ") + " ORDER BY e.expense_date DESC, e.id DESC LIMIT ? OFFSET ?"
	args = append(args, limit, filter.Offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	expenses := []domain.Expense{}
	for rows.Next() {
		expense, err := scanExpense(rows)
		if err != nil {
			return nil, err
		}
		expenses = append(expenses, *expense)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range expenses {
		if err := r.attachExpenseTags(ctx, &expenses[i]); err != nil {
			return nil, err
		}
	}
	return expenses, nil
}

func (r *ExpenseRepository) ListTags(ctx context.Context, householdID uint64, search string) ([]domain.Tag, error) {
	if err := r.deleteUnusedTags(ctx, r.db, householdID); err != nil {
		return nil, err
	}
	query := `
		SELECT id, household_id, name
		FROM tags
		WHERE household_id = ?
	`
	args := []any{householdID}
	if strings.TrimSpace(search) != "" {
		query += " AND normalized_name LIKE ?"
		args = append(args, "%"+normalizedTagName(search)+"%")
	}
	query += " ORDER BY name LIMIT 500"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tags := []domain.Tag{}
	for rows.Next() {
		var tag domain.Tag
		if err := rows.Scan(&tag.ID, &tag.HouseholdID, &tag.Name); err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}
	return tags, rows.Err()
}

func (r *ExpenseRepository) MonthTotal(ctx context.Context, month time.Time, householdID uint64) (int64, error) {
	start, end := monthBounds(month)
	var total sql.NullInt64
	err := r.db.QueryRowContext(ctx, `
		SELECT SUM(converted_amount_minor)
		FROM expenses
		WHERE deleted_at IS NULL AND household_id = ? AND expense_date >= ? AND expense_date < ?
	`, householdID, start, end).Scan(&total)
	if err != nil {
		return 0, err
	}
	return total.Int64, nil
}

func (r *ExpenseRepository) SummaryByCategory(ctx context.Context, month time.Time, householdID uint64) ([]domain.SummaryRow, error) {
	start, end := monthBounds(month)
	rows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.name, SUM(e.converted_amount_minor), COUNT(*), MAX(e.converted_currency_code)
		FROM expenses e
		JOIN categories c ON c.id = e.category_id
		WHERE e.deleted_at IS NULL AND e.household_id = ? AND e.expense_date >= ? AND e.expense_date < ?
		GROUP BY c.id, c.name
		ORDER BY SUM(e.converted_amount_minor) DESC
	`, householdID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSummaryRows(rows)
}

func (r *ExpenseRepository) SummaryByCategoryBetween(ctx context.Context, start time.Time, end time.Time, householdID uint64) ([]domain.SummaryRow, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.name, SUM(e.converted_amount_minor), COUNT(*), MAX(e.converted_currency_code)
		FROM expenses e
		JOIN categories c ON c.id = e.category_id
		WHERE e.deleted_at IS NULL AND e.household_id = ? AND e.expense_date >= ? AND e.expense_date < ?
		GROUP BY c.id, c.name
		ORDER BY SUM(e.converted_amount_minor) DESC
	`, householdID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSummaryRows(rows)
}

func (r *ExpenseRepository) SummaryBySubcategory(ctx context.Context, month time.Time, householdID uint64) ([]domain.SummaryRow, error) {
	start, end := monthBounds(month)
	rows, err := r.db.QueryContext(ctx, `
		SELECT sc.id, sc.name, SUM(e.converted_amount_minor), COUNT(*), MAX(e.converted_currency_code)
		FROM expenses e
		JOIN category_subcategories sc ON sc.id = e.subcategory_id
		WHERE e.deleted_at IS NULL AND e.household_id = ? AND e.expense_date >= ? AND e.expense_date < ?
		GROUP BY sc.id, sc.name
		ORDER BY SUM(e.converted_amount_minor) DESC
	`, householdID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSummaryRows(rows)
}

func (r *ExpenseRepository) SummaryByPaymentSource(ctx context.Context, month time.Time, householdID uint64) ([]domain.SummaryRow, error) {
	start, end := monthBounds(month)
	rows, err := r.db.QueryContext(ctx, `
		SELECT ps.id, ps.name, SUM(e.converted_amount_minor), COUNT(*), MAX(e.converted_currency_code)
		FROM expenses e
		JOIN payment_sources ps ON ps.id = e.payment_source_id
		WHERE e.deleted_at IS NULL AND e.household_id = ? AND e.expense_date >= ? AND e.expense_date < ?
		GROUP BY ps.id, ps.name
		ORDER BY SUM(e.converted_amount_minor) DESC
	`, householdID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanSummaryRows(rows)
}

type scanner interface {
	Scan(dest ...any) error
}

func baseExpenseSelect() string {
	return `
		SELECT e.id,
			e.household_id,
			e.original_amount_minor,
			e.original_currency_code,
			e.converted_amount_minor,
			e.converted_currency_code,
			e.exchange_rate,
			e.category_id,
			e.subcategory_id,
			COALESCE(sc.name, ''),
			e.payment_source_id,
			e.merchant,
			e.notes,
			e.expense_date,
			e.created_by,
			COALESCE(CAST(e.metadata_json AS CHAR), ''),
			e.created_at,
			e.updated_at
		FROM expenses e
		LEFT JOIN category_subcategories sc ON sc.id = e.subcategory_id
	`
}

func scanExpense(row scanner) (*domain.Expense, error) {
	var expense domain.Expense
	var exchangeRate string
	var subcategoryID sql.NullInt64
	err := row.Scan(
		&expense.ID,
		&expense.HouseholdID,
		&expense.OriginalAmountMinor,
		&expense.OriginalCurrencyCode,
		&expense.ConvertedAmountMinor,
		&expense.ConvertedCurrencyCode,
		&exchangeRate,
		&expense.CategoryID,
		&subcategoryID,
		&expense.SubcategoryName,
		&expense.PaymentSourceID,
		&expense.Merchant,
		&expense.Notes,
		&expense.ExpenseDate,
		&expense.CreatedBy,
		&expense.MetadataJSON,
		&expense.CreatedAt,
		&expense.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	parsed, err := decimal.NewFromString(exchangeRate)
	if err != nil {
		return nil, err
	}
	expense.ExchangeRate = parsed
	if subcategoryID.Valid && subcategoryID.Int64 > 0 {
		id := uint64(subcategoryID.Int64)
		expense.SubcategoryID = &id
	}
	return &expense, nil
}

func scanSummaryRows(rows *sql.Rows) ([]domain.SummaryRow, error) {
	summaryRows := []domain.SummaryRow{}
	for rows.Next() {
		var row domain.SummaryRow
		if err := rows.Scan(&row.ID, &row.Name, &row.AmountMinor, &row.TransactionCount, &row.CurrencyCode); err != nil {
			return nil, err
		}
		summaryRows = append(summaryRows, row)
	}
	return summaryRows, rows.Err()
}

func monthBounds(month time.Time) (time.Time, time.Time) {
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, month.Location())
	return start, start.AddDate(0, 1, 0)
}

func subcategoryValue(id *uint64) any {
	if id == nil || *id == 0 {
		return nil
	}
	return *id
}

func appendIDFilter(where []string, args []any, column string, ids []uint64) ([]string, []any) {
	if len(ids) == 0 {
		return where, args
	}
	marks := make([]string, len(ids))
	for i, id := range ids {
		marks[i] = "?"
		args = append(args, id)
	}
	where = append(where, column+" IN ("+strings.Join(marks, ",")+")")
	return where, args
}

type execQuerier interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

func (r *ExpenseRepository) syncExpenseTags(ctx context.Context, tx *sql.Tx, expenseID uint64, householdID uint64, tags []string) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM expense_tags WHERE expense_id = ?`, expenseID); err != nil {
		return err
	}
	for _, tagName := range normalizeTagNames(tags) {
		tagID, err := r.ensureTag(ctx, tx, householdID, tagName)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT IGNORE INTO expense_tags (expense_id, tag_id)
			VALUES (?, ?)
		`, expenseID, tagID); err != nil {
			return err
		}
	}
	return nil
}

func (r *ExpenseRepository) ensureTag(ctx context.Context, tx execQuerier, householdID uint64, name string) (uint64, error) {
	normalized := normalizedTagName(name)
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO tags (household_id, name, normalized_name)
		VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), name = VALUES(name)
	`, householdID, name, normalized); err != nil {
		return 0, err
	}
	var id uint64
	if err := tx.QueryRowContext(ctx, `
		SELECT LAST_INSERT_ID()
	`).Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

func (r *ExpenseRepository) deleteUnusedTags(ctx context.Context, exec execQuerier, householdID uint64) error {
	if _, err := exec.ExecContext(ctx, `
		DELETE et
		FROM expense_tags et
		INNER JOIN expenses e ON e.id = et.expense_id
		INNER JOIN tags t ON t.id = et.tag_id
		WHERE t.household_id = ? AND e.deleted_at IS NOT NULL
	`, householdID); err != nil {
		return err
	}
	_, err := exec.ExecContext(ctx, `
		DELETE FROM tags
		WHERE household_id = ?
			AND NOT EXISTS (
				SELECT 1 FROM expense_tags et WHERE et.tag_id = tags.id
			)
	`, householdID)
	return err
}

func (r *ExpenseRepository) attachExpenseTags(ctx context.Context, expense *domain.Expense) error {
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.name
		FROM expense_tags et
		JOIN tags t ON t.id = et.tag_id
		WHERE et.expense_id = ?
		ORDER BY t.name
	`, expense.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	expense.Tags = []string{}
	for rows.Next() {
		var tag string
		if err := rows.Scan(&tag); err != nil {
			return err
		}
		expense.Tags = append(expense.Tags, tag)
	}
	return rows.Err()
}

func normalizeTagNames(tags []string) []string {
	seen := map[string]bool{}
	normalized := []string{}
	for _, tag := range tags {
		name := strings.TrimSpace(strings.TrimPrefix(tag, "#"))
		if name == "" {
			continue
		}
		if len(name) > 80 {
			name = name[:80]
		}
		key := normalizedTagName(name)
		if key == "" || seen[key] {
			continue
		}
		seen[key] = true
		normalized = append(normalized, name)
	}
	return normalized
}

func normalizedTagName(tag string) string {
	return strings.ToLower(strings.TrimSpace(strings.TrimPrefix(tag, "#")))
}
