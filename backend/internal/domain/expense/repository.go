package expense

import (
	"context"
	"time"
)

type Repository interface {
	Create(ctx context.Context, expense *Expense) error
	Update(ctx context.Context, expense Expense) error
	Delete(ctx context.Context, id uint64, householdID uint64) error
	GetByID(ctx context.Context, id uint64, householdID uint64) (*Expense, error)
	List(ctx context.Context, filter Filter) ([]Expense, error)
	ListTags(ctx context.Context, householdID uint64, search string) ([]Tag, error)
	MonthTotal(ctx context.Context, month time.Time, householdID uint64) (int64, error)
	SummaryByCategory(ctx context.Context, month time.Time, householdID uint64) ([]SummaryRow, error)
	SummaryByPaymentSource(ctx context.Context, month time.Time, householdID uint64) ([]SummaryRow, error)
}
