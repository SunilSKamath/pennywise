package budget

import "context"

type Repository interface {
	Upsert(ctx context.Context, budget *Budget) error
	Delete(ctx context.Context, id uint64, householdID uint64) error
	GetByID(ctx context.Context, id uint64, householdID uint64) (*Budget, error)
	ListByMonth(ctx context.Context, householdID uint64, month string) ([]Budget, error)
}
