package mysql

import (
	"context"
	"database/sql"
	"errors"
	"strings"

	householddomain "github.com/creation/pennywise/backend/internal/domain/household"
	domain "github.com/creation/pennywise/backend/internal/domain/user"
)

type UserRepository struct {
	db         *sql.DB
	adminEmail string
}

func NewUserRepository(db *sql.DB, adminEmail string) *UserRepository {
	return &UserRepository{
		db:         db,
		adminEmail: strings.ToLower(strings.TrimSpace(adminEmail)),
	}
}

func (r *UserRepository) UpsertGoogle(ctx context.Context, user *domain.User) error {
	if user.HouseholdID == 0 {
		user.HouseholdID = 1
	}
	if user.Role == "" {
		user.Role = domain.RoleUser
	}
	if user.Status == "" {
		user.Status = domain.StatusPending
	}
	isAdminEmail := r.isAdminEmail(user.Email)
	if isAdminEmail {
		user.Role = domain.RoleAdmin
		user.Status = domain.StatusActive
	}
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO users (household_id, google_id, email, name, picture_url, role, status)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE
			id = LAST_INSERT_ID(id),
			email = VALUES(email),
			name = VALUES(name),
			picture_url = VALUES(picture_url)
	`, user.HouseholdID, user.GoogleID, user.Email, user.Name, user.PictureURL, user.Role, user.Status)
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	user.ID = uint64(id)
	if isAdminEmail {
		if _, err := r.db.ExecContext(ctx, `
			UPDATE users
			SET role = ?, status = ?
			WHERE id = ?
		`, domain.RoleAdmin, domain.StatusActive, user.ID); err != nil {
			return err
		}
	}
	if err := r.ensureHouseholdAccess(ctx, user.ID, user.HouseholdID); err != nil {
		return err
	}
	stored, err := r.GetByID(ctx, user.ID)
	if err != nil {
		return err
	}
	*user = *stored
	return nil
}

func (r *UserRepository) GetByID(ctx context.Context, id uint64) (*domain.User, error) {
	var user domain.User
	err := r.db.QueryRowContext(ctx, `
		SELECT id, household_id, google_id, email, name, picture_url, role, status
		FROM users
		WHERE id = ?
	`, id).Scan(&user.ID, &user.HouseholdID, &user.GoogleID, &user.Email, &user.Name, &user.PictureURL, &user.Role, &user.Status)
	if err != nil {
		return nil, err
	}
	if err := r.attachHouseholds(ctx, &user); err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) ListByHousehold(ctx context.Context, householdID uint64) ([]domain.User, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, household_id, google_id, email, name, picture_url, role, status
		FROM users
		WHERE household_id = ?
		ORDER BY status DESC, name, email
	`, householdID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []domain.User{}
	for rows.Next() {
		var user domain.User
		if err := rows.Scan(&user.ID, &user.HouseholdID, &user.GoogleID, &user.Email, &user.Name, &user.PictureURL, &user.Role, &user.Status); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range users {
		if err := r.attachHouseholds(ctx, &users[i]); err != nil {
			return nil, err
		}
	}
	return users, nil
}

func (r *UserRepository) UpdateAccess(ctx context.Context, id uint64, householdID uint64, role domain.Role, status domain.Status) (*domain.User, error) {
	if !validRole(role) {
		return nil, errors.New("role must be admin or user")
	}
	if !validStatus(status) {
		return nil, errors.New("status must be pending or active")
	}
	result, err := r.db.ExecContext(ctx, `
		UPDATE users
		SET role = ?, status = ?
		WHERE id = ? AND household_id = ?
	`, role, status, id, householdID)
	if err != nil {
		return nil, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, sql.ErrNoRows
	}
	return r.GetByID(ctx, id)
}

func (r *UserRepository) ListHouseholds(ctx context.Context) ([]householddomain.Household, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, base_currency_code
		FROM households
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	households := []householddomain.Household{}
	for rows.Next() {
		var household householddomain.Household
		if err := rows.Scan(&household.ID, &household.Name, &household.BaseCurrencyCode); err != nil {
			return nil, err
		}
		households = append(households, household)
	}
	return households, rows.Err()
}

func (r *UserRepository) CreateHousehold(ctx context.Context, household *householddomain.Household) error {
	result, err := r.db.ExecContext(ctx, `
		INSERT INTO households (name, base_currency_code)
		VALUES (?, ?)
	`, strings.TrimSpace(household.Name), strings.ToUpper(strings.TrimSpace(household.BaseCurrencyCode)))
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	household.ID = uint64(id)
	household.BaseCurrencyCode = strings.ToUpper(strings.TrimSpace(household.BaseCurrencyCode))
	return nil
}

func (r *UserRepository) SetHouseholdAccess(ctx context.Context, userID uint64, householdIDs []uint64) (*domain.User, error) {
	uniqueHouseholdIDs := uniqueUint64s(householdIDs)
	if len(uniqueHouseholdIDs) == 0 {
		return nil, errors.New("at least one household is required")
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `DELETE FROM user_households WHERE user_id = ?`, userID); err != nil {
		return nil, err
	}
	for _, householdID := range uniqueHouseholdIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO user_households (user_id, household_id)
			VALUES (?, ?)
		`, userID, householdID); err != nil {
			return nil, err
		}
	}
	defaultHouseholdID := uniqueHouseholdIDs[0]
	if _, err := tx.ExecContext(ctx, `
		UPDATE users
		SET household_id = ?
		WHERE id = ?
	`, defaultHouseholdID, userID); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.GetByID(ctx, userID)
}

func validRole(role domain.Role) bool {
	return role == domain.RoleAdmin || role == domain.RoleUser
}

func validStatus(status domain.Status) bool {
	return status == domain.StatusPending || status == domain.StatusActive
}

func (r *UserRepository) isAdminEmail(email string) bool {
	return r.adminEmail != "" && strings.EqualFold(strings.TrimSpace(email), r.adminEmail)
}

func (r *UserRepository) ensureHouseholdAccess(ctx context.Context, userID uint64, householdID uint64) error {
	if userID == 0 || householdID == 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT IGNORE INTO user_households (user_id, household_id)
		VALUES (?, ?)
	`, userID, householdID)
	return err
}

func (r *UserRepository) attachHouseholds(ctx context.Context, user *domain.User) error {
	rows, err := r.db.QueryContext(ctx, `
		SELECT h.id, h.name, h.base_currency_code
		FROM user_households uh
		JOIN households h ON h.id = uh.household_id
		WHERE uh.user_id = ?
		ORDER BY h.name
	`, user.ID)
	if err != nil {
		return err
	}
	defer rows.Close()

	user.Households = []householddomain.Household{}
	for rows.Next() {
		var household householddomain.Household
		if err := rows.Scan(&household.ID, &household.Name, &household.BaseCurrencyCode); err != nil {
			return err
		}
		user.Households = append(user.Households, household)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(user.Households) == 0 && user.HouseholdID != 0 {
		return r.ensureHouseholdAccess(ctx, user.ID, user.HouseholdID)
	}
	return nil
}

func uniqueUint64s(values []uint64) []uint64 {
	seen := map[uint64]bool{}
	unique := []uint64{}
	for _, value := range values {
		if value == 0 || seen[value] {
			continue
		}
		seen[value] = true
		unique = append(unique, value)
	}
	return unique
}
