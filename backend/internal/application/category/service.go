package category

import (
	"context"
	"errors"
	"strings"

	domain "github.com/creation/pennywise/backend/internal/domain/category"
)

type Service struct {
	repo domain.Repository
}

func NewService(repo domain.Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Create(ctx context.Context, name, emoji string) (*domain.Category, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("category name is required")
	}
	emoji = strings.TrimSpace(emoji)
	if emoji == "" {
		emoji = "📦"
	}

	category := &domain.Category{Name: name, Emoji: emoji}
	if err := s.repo.Create(ctx, category); err != nil {
		return nil, err
	}
	return category, nil
}

func (s *Service) List(ctx context.Context) ([]domain.Category, error) {
	return s.repo.List(ctx)
}
