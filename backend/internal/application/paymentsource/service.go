package paymentsource

import (
	"context"
	"errors"
	"strings"

	domain "github.com/creation/pennywise/backend/internal/domain/paymentsource"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, input CreateInput) (*domain.PaymentSource, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.CurrencyCode = strings.ToUpper(strings.TrimSpace(input.CurrencyCode))
	if input.Name == "" {
		return nil, errors.New("payment source name is required")
	}
	if input.CurrencyCode == "" {
		return nil, errors.New("currency code is required")
	}
	if !isValidType(input.Type) {
		return nil, errors.New("payment source type is invalid")
	}

	paymentSource := &domain.PaymentSource{
		Name:         input.Name,
		Type:         input.Type,
		CurrencyCode: input.CurrencyCode,
	}
	if err := s.repo.Create(ctx, paymentSource); err != nil {
		return nil, err
	}
	return paymentSource, nil
}

func (s *Service) List(ctx context.Context) ([]domain.PaymentSource, error) {
	return s.repo.List(ctx)
}

type CreateInput struct {
	Name         string
	Type         domain.Type
	CurrencyCode string
}

func isValidType(value domain.Type) bool {
	switch value {
	case domain.TypeBankAccount, domain.TypeCreditCard, domain.TypeUPI, domain.TypeCash, domain.TypeOther:
		return true
	default:
		return false
	}
}
