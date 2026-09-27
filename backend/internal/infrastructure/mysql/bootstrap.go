package mysql

import (
	"context"
	"database/sql"
)

func EnsureDefaults(ctx context.Context, db *sql.DB) error {
	if err := ensureDevUser(ctx, db); err != nil {
		return err
	}
	if err := ensureCategories(ctx, db); err != nil {
		return err
	}
	return ensurePaymentSources(ctx, db)
}

func ensureDevUser(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO users (id, household_id, google_id, email, name, picture_url, role, status)
		VALUES (1, 1, 'dev-user', 'dev@example.local', 'Dev User', '', 'user', 'pending')
		ON DUPLICATE KEY UPDATE
			household_id = VALUES(household_id),
			google_id = VALUES(google_id),
			email = VALUES(email),
			name = VALUES(name),
			picture_url = VALUES(picture_url)
	`)
	return err
}

func ensureCategories(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO categories (name)
		SELECT name
		FROM (
			SELECT 'Food' AS name UNION ALL
			SELECT 'Travel' UNION ALL
			SELECT 'Shopping' UNION ALL
			SELECT 'Bills' UNION ALL
			SELECT 'Health' UNION ALL
			SELECT 'Home' UNION ALL
			SELECT 'Entertainment'
		) defaults
		WHERE NOT EXISTS (
			SELECT 1
			FROM categories c
			WHERE c.name = defaults.name AND c.deleted_at IS NULL
		)
	`)
	return err
}

func ensurePaymentSources(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, `
		INSERT INTO payment_sources (name, type, currency_code)
		SELECT name, type, currency_code
		FROM (
			SELECT 'Cash' AS name, 'cash' AS type, 'INR' AS currency_code UNION ALL
			SELECT 'Google Pay', 'upi', 'INR' UNION ALL
			SELECT 'Savings Account', 'bank_account', 'INR'
		) defaults
		WHERE NOT EXISTS (
			SELECT 1
			FROM payment_sources ps
			WHERE ps.name = defaults.name AND ps.deleted_at IS NULL
		)
	`)
	return err
}
