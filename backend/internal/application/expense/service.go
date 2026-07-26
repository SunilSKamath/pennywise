package expense

import (
	"context"
	"errors"
	"strings"
	"time"

	categorydomain "github.com/creation/pennywise/backend/internal/domain/category"
	domain "github.com/creation/pennywise/backend/internal/domain/expense"
	paymentsourcedomain "github.com/creation/pennywise/backend/internal/domain/paymentsource"
)

type Service struct {
	expenses              domain.Repository
	categories            categorydomain.Repository
	paymentSources        paymentsourcedomain.Repository
	exchangeRates         domain.ExchangeRateProvider
	householdCurrencyCode string
}

func NewService(
	expenses domain.Repository,
	categories categorydomain.Repository,
	paymentSources paymentsourcedomain.Repository,
	exchangeRates domain.ExchangeRateProvider,
	householdCurrencyCode string,
) *Service {
	return &Service{
		expenses:              expenses,
		categories:            categories,
		paymentSources:        paymentSources,
		exchangeRates:         exchangeRates,
		householdCurrencyCode: strings.ToUpper(householdCurrencyCode),
	}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*domain.Expense, error) {
	if err := s.validateReferences(ctx, input.CategoryID, input.PaymentSourceID); err != nil {
		return nil, err
	}
	if input.OriginalAmountMinor <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}
	if input.ExpenseDate.IsZero() {
		input.ExpenseDate = time.Now()
	}
	if input.CreatedBy == 0 {
		return nil, errors.New("created_by is required")
	}
	if input.HouseholdID == 0 {
		return nil, errors.New("household_id is required")
	}

	from := strings.ToUpper(strings.TrimSpace(input.OriginalCurrencyCode))
	if from == "" {
		return nil, errors.New("original currency code is required")
	}

	conversion, err := s.exchangeRates.Convert(ctx, input.OriginalAmountMinor, from, s.householdCurrencyCode)
	if err != nil {
		return nil, err
	}

	expense := &domain.Expense{
		HouseholdID:           input.HouseholdID,
		OriginalAmountMinor:   conversion.OriginalAmountMinor,
		OriginalCurrencyCode:  conversion.OriginalCurrencyCode,
		ConvertedAmountMinor:  conversion.ConvertedAmountMinor,
		ConvertedCurrencyCode: conversion.ConvertedCurrencyCode,
		ExchangeRate:          conversion.ExchangeRate,
		CategoryID:            input.CategoryID,
		PaymentSourceID:       input.PaymentSourceID,
		Merchant:              strings.TrimSpace(input.Merchant),
		Notes:                 strings.TrimSpace(input.Notes),
		ExpenseDate:           input.ExpenseDate,
		CreatedBy:             input.CreatedBy,
		MetadataJSON:          strings.TrimSpace(input.MetadataJSON),
		Tags:                  normalizeTags(input.Tags),
	}
	if err := s.expenses.Create(ctx, expense); err != nil {
		return nil, err
	}
	return expense, nil
}

func (s *Service) Update(ctx context.Context, input UpdateInput) (*domain.Expense, error) {
	if input.HouseholdID == 0 {
		return nil, errors.New("household_id is required")
	}
	existing, err := s.expenses.GetByID(ctx, input.ID, input.HouseholdID)
	if err != nil {
		return nil, err
	}
	categoryID := existing.CategoryID
	if input.CategoryID != nil {
		categoryID = *input.CategoryID
	}
	paymentSourceID := existing.PaymentSourceID
	if input.PaymentSourceID != nil {
		paymentSourceID = *input.PaymentSourceID
	}
	if err := s.validateReferences(ctx, categoryID, paymentSourceID); err != nil {
		return nil, err
	}

	if input.OriginalAmountMinor != nil || input.OriginalCurrencyCode != nil {
		amount := existing.OriginalAmountMinor
		if input.OriginalAmountMinor != nil {
			if *input.OriginalAmountMinor <= 0 {
				return nil, errors.New("amount must be greater than zero")
			}
			amount = *input.OriginalAmountMinor
		}
		currency := existing.OriginalCurrencyCode
		if input.OriginalCurrencyCode != nil {
			currency = strings.ToUpper(strings.TrimSpace(*input.OriginalCurrencyCode))
		}
		conversion, err := s.exchangeRates.Convert(ctx, amount, currency, s.householdCurrencyCode)
		if err != nil {
			return nil, err
		}
		existing.OriginalAmountMinor = conversion.OriginalAmountMinor
		existing.OriginalCurrencyCode = conversion.OriginalCurrencyCode
		existing.ConvertedAmountMinor = conversion.ConvertedAmountMinor
		existing.ConvertedCurrencyCode = conversion.ConvertedCurrencyCode
		existing.ExchangeRate = conversion.ExchangeRate
	}

	existing.CategoryID = categoryID
	existing.PaymentSourceID = paymentSourceID
	if input.Merchant != nil {
		existing.Merchant = strings.TrimSpace(*input.Merchant)
	}
	if input.Notes != nil {
		existing.Notes = strings.TrimSpace(*input.Notes)
	}
	if input.ExpenseDate != nil {
		existing.ExpenseDate = *input.ExpenseDate
	}
	if input.MetadataJSON != nil {
		existing.MetadataJSON = strings.TrimSpace(*input.MetadataJSON)
	}
	if input.Tags != nil {
		existing.Tags = normalizeTags(*input.Tags)
	}

	if err := s.expenses.Update(ctx, *existing); err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) Delete(ctx context.Context, id uint64, householdID uint64) error {
	return s.expenses.Delete(ctx, id, householdID)
}

func (s *Service) GetByID(ctx context.Context, id uint64, householdID uint64) (*domain.Expense, error) {
	return s.expenses.GetByID(ctx, id, householdID)
}

func (s *Service) List(ctx context.Context, filter domain.Filter) ([]domain.Expense, error) {
	return s.expenses.List(ctx, filter)
}

func (s *Service) ListTags(ctx context.Context, householdID uint64, search string) ([]domain.Tag, error) {
	return s.expenses.ListTags(ctx, householdID, search)
}

func (s *Service) validateReferences(ctx context.Context, categoryID uint64, paymentSourceID uint64) error {
	if categoryID == 0 {
		return errors.New("category_id is required")
	}
	if paymentSourceID == 0 {
		return errors.New("payment_source_id is required")
	}
	if _, err := s.categories.GetByID(ctx, categoryID); err != nil {
		return err
	}
	if _, err := s.paymentSources.GetByID(ctx, paymentSourceID); err != nil {
		return err
	}
	return nil
}

type CreateInput struct {
	OriginalAmountMinor  int64
	OriginalCurrencyCode string
	CategoryID           uint64
	PaymentSourceID      uint64
	Merchant             string
	Notes                string
	ExpenseDate          time.Time
	CreatedBy            uint64
	HouseholdID          uint64
	MetadataJSON         string
	Tags                 []string
}

type UpdateInput struct {
	ID                   uint64
	HouseholdID          uint64
	OriginalAmountMinor  *int64
	OriginalCurrencyCode *string
	CategoryID           *uint64
	PaymentSourceID      *uint64
	Merchant             *string
	Notes                *string
	ExpenseDate          *time.Time
	MetadataJSON         *string
	Tags                 *[]string
}

func normalizeTags(tags []string) []string {
	seen := map[string]bool{}
	result := []string{}
	for _, tag := range tags {
		value := strings.TrimSpace(strings.TrimPrefix(tag, "#"))
		if value == "" {
			continue
		}
		key := strings.ToLower(value)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, value)
	}
	return result
}
