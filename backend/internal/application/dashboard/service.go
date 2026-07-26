package dashboard

import (
	"context"
	"time"

	domain "github.com/creation/pennywise/backend/internal/domain/expense"
)

type Service struct {
	expenses domain.Repository
}

func NewService(expenses domain.Repository) *Service {
	return &Service{expenses: expenses}
}

func (s *Service) Get(ctx context.Context, month time.Time, householdID uint64) (*Summary, error) {
	month = time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, month.Location())

	total, err := s.expenses.MonthTotal(ctx, month, householdID)
	if err != nil {
		return nil, err
	}
	byCategory, err := s.expenses.SummaryByCategory(ctx, month, householdID)
	if err != nil {
		return nil, err
	}
	byPaymentSource, err := s.expenses.SummaryByPaymentSource(ctx, month, householdID)
	if err != nil {
		return nil, err
	}

	return &Summary{
		MonthTotal:      total,
		ByCategory:      byCategory,
		ByPaymentSource: byPaymentSource,
	}, nil
}

type Summary struct {
	MonthTotal      int64               `json:"month_total"`
	ByCategory      []domain.SummaryRow `json:"by_category"`
	ByPaymentSource []domain.SummaryRow `json:"by_payment_source"`
}
