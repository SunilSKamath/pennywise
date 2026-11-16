package mysql

import (
	"context"
	"database/sql"

	domain "github.com/creation/pennywise/backend/internal/domain/paymentsource"
)

type PaymentSourceRepository struct {
	db *sql.DB
}

func NewPaymentSourceRepository(db *sql.DB) *PaymentSourceRepository {
	return &PaymentSourceRepository{db: db}
}

func (r *PaymentSourceRepository) Create(ctx context.Context, paymentSource *domain.PaymentSource) error {
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO payment_sources (household_id, name, type, currency_code)
		VALUES (?, ?, ?, ?)
	`, paymentSource.HouseholdID, paymentSource.Name, paymentSource.Type, paymentSource.CurrencyCode)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	paymentSource.ID = uint64(id)
	return nil
}

func (r *PaymentSourceRepository) GetByID(ctx context.Context, id uint64, householdID uint64) (*domain.PaymentSource, error) {
	var paymentSource domain.PaymentSource
	err := r.db.QueryRowContext(ctx, `
		SELECT id, household_id, name, type, currency_code
		FROM payment_sources
		WHERE id = ? AND household_id = ? AND deleted_at IS NULL
	`, id, householdID).Scan(
		&paymentSource.ID,
		&paymentSource.HouseholdID,
		&paymentSource.Name,
		&paymentSource.Type,
		&paymentSource.CurrencyCode,
	)
	if err != nil {
		return nil, err
	}
	return &paymentSource, nil
}

func (r *PaymentSourceRepository) List(ctx context.Context, householdID uint64) ([]domain.PaymentSource, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, household_id, name, type, currency_code
		FROM payment_sources
		WHERE household_id = ? AND deleted_at IS NULL
		ORDER BY name
	`, householdID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	paymentSources := []domain.PaymentSource{}
	for rows.Next() {
		var paymentSource domain.PaymentSource
		if err := rows.Scan(
			&paymentSource.ID,
			&paymentSource.HouseholdID,
			&paymentSource.Name,
			&paymentSource.Type,
			&paymentSource.CurrencyCode,
		); err != nil {
			return nil, err
		}
		paymentSources = append(paymentSources, paymentSource)
	}
	return paymentSources, rows.Err()
}
