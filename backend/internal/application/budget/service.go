package budget

import (
	"context"
	"errors"
	"strings"
	"time"

	domain "github.com/creation/pennywise/backend/internal/domain/budget"
	categorydomain "github.com/creation/pennywise/backend/internal/domain/category"
	expensedomain "github.com/creation/pennywise/backend/internal/domain/expense"
)

type Service struct {
	budgets    domain.Repository
	expenses   expensedomain.Repository
	categories categorydomain.Repository
}

func NewService(budgets domain.Repository, expenses expensedomain.Repository, categories categorydomain.Repository) *Service {
	return &Service{budgets: budgets, expenses: expenses, categories: categories}
}

type UpsertInput struct {
	HouseholdID  uint64
	CategoryID   uint64
	Month        string
	AmountMinor  int64
	CurrencyCode string
}

func (s *Service) Upsert(ctx context.Context, input UpsertInput) (*domain.Budget, error) {
	month := strings.TrimSpace(input.Month)
	if _, err := time.Parse("2006-01", month); err != nil {
		return nil, errors.New("month must use YYYY-MM")
	}
	if input.AmountMinor <= 0 {
		return nil, errors.New("budget amount must be greater than zero")
	}
	if _, err := s.categories.GetByID(ctx, input.CategoryID); err != nil {
		return nil, errors.New("category not found")
	}
	currency := strings.ToUpper(strings.TrimSpace(input.CurrencyCode))
	if len(currency) != 3 {
		return nil, errors.New("currency code must be 3 letters")
	}

	budget := &domain.Budget{
		HouseholdID:  input.HouseholdID,
		CategoryID:   input.CategoryID,
		Month:        month,
		AmountMinor:  input.AmountMinor,
		CurrencyCode: currency,
	}
	if err := s.budgets.Upsert(ctx, budget); err != nil {
		return nil, err
	}
	return budget, nil
}

func (s *Service) Delete(ctx context.Context, id uint64, householdID uint64) error {
	return s.budgets.Delete(ctx, id, householdID)
}

func (s *Service) ListWithProgress(ctx context.Context, householdID uint64, month string) ([]domain.WithProgress, error) {
	month = strings.TrimSpace(month)
	parsed, err := time.Parse("2006-01", month)
	if err != nil {
		return nil, errors.New("month must use YYYY-MM")
	}

	budgets, err := s.budgets.ListByMonth(ctx, householdID, month)
	if err != nil {
		return nil, err
	}
	spentByCategory, err := s.expenses.SummaryByCategory(ctx, parsed, householdID)
	if err != nil {
		return nil, err
	}
	spentMap := map[uint64]int64{}
	for _, row := range spentByCategory {
		spentMap[row.ID] = row.AmountMinor
	}

	result := make([]domain.WithProgress, 0, len(budgets))
	for _, budget := range budgets {
		result = append(result, domain.WithProgress{
			Budget:     budget,
			SpentMinor: spentMap[budget.CategoryID],
		})
	}
	return result, nil
}
