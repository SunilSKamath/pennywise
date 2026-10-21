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
	HouseholdID   uint64
	CategoryID    uint64
	SubcategoryID *uint64
	Month         string
	AmountMinor   int64
	CurrencyCode  string
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
	subcategoryID, subcategoryName, err := s.normalizeSubcategory(ctx, input.CategoryID, input.SubcategoryID)
	if err != nil {
		return nil, err
	}
	currency := strings.ToUpper(strings.TrimSpace(input.CurrencyCode))
	if len(currency) != 3 {
		return nil, errors.New("currency code must be 3 letters")
	}

	budget := &domain.Budget{
		HouseholdID:     input.HouseholdID,
		CategoryID:      input.CategoryID,
		SubcategoryID:   subcategoryID,
		SubcategoryName: subcategoryName,
		Month:           month,
		AmountMinor:     input.AmountMinor,
		CurrencyCode:    currency,
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
	spentBySubcategory, err := s.expenses.SummaryBySubcategory(ctx, parsed, householdID)
	if err != nil {
		return nil, err
	}
	spentByCategoryID := map[uint64]int64{}
	for _, row := range spentByCategory {
		spentByCategoryID[row.ID] = row.AmountMinor
	}
	spentBySubcategoryID := map[uint64]int64{}
	for _, row := range spentBySubcategory {
		spentBySubcategoryID[row.ID] = row.AmountMinor
	}

	result := make([]domain.WithProgress, 0, len(budgets))
	for _, budget := range budgets {
		spent := spentByCategoryID[budget.CategoryID]
		if budget.SubcategoryID != nil {
			spent = spentBySubcategoryID[*budget.SubcategoryID]
		}
		result = append(result, domain.WithProgress{
			Budget:     budget,
			SpentMinor: spent,
		})
	}
	return result, nil
}

func (s *Service) normalizeSubcategory(ctx context.Context, categoryID uint64, subcategoryID *uint64) (*uint64, string, error) {
	if subcategoryID == nil || *subcategoryID == 0 {
		return nil, "", nil
	}
	subcategory, err := s.categories.GetSubcategory(ctx, *subcategoryID)
	if err != nil {
		return nil, "", err
	}
	if subcategory.CategoryID != categoryID {
		return nil, "", errors.New("subcategory does not belong to the category")
	}
	if subcategory.Deleted {
		return nil, "", errors.New("subcategory is not available")
	}
	id := subcategory.ID
	return &id, subcategory.Name, nil
}
