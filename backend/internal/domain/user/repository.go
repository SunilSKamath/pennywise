package user

import "context"

import householddomain "github.com/creation/pennywise/backend/internal/domain/household"

type Repository interface {
	UpsertGoogle(ctx context.Context, user *User) error
	GetByID(ctx context.Context, id uint64) (*User, error)
	ListByHousehold(ctx context.Context, householdID uint64) ([]User, error)
	UpdateAccess(ctx context.Context, id uint64, householdID uint64, role Role, status Status) (*User, error)
	ListHouseholds(ctx context.Context) ([]householddomain.Household, error)
	CreateHousehold(ctx context.Context, household *householddomain.Household) error
	SetHouseholdAccess(ctx context.Context, userID uint64, householdIDs []uint64) (*User, error)
}
