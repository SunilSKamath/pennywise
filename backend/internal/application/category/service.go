package category

import (
	"context"
	"database/sql"
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

	category := &domain.Category{Name: name, Emoji: emoji, Subcategories: []domain.Subcategory{}}
	if err := s.repo.Create(ctx, category); err != nil {
		return nil, err
	}
	return category, nil
}

func (s *Service) UpdateEmoji(ctx context.Context, id uint64, emoji string) (*domain.Category, error) {
	emoji = strings.TrimSpace(emoji)
	if emoji == "" {
		emoji = "📦"
	}
	if len([]rune(emoji)) > 8 {
		return nil, errors.New("emoji is too long")
	}
	if err := s.repo.UpdateEmoji(ctx, id, emoji); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	return s.repo.GetByID(ctx, id)
}

func (s *Service) SetYearlyBudgetEnabled(ctx context.Context, id uint64, enabled bool) (*domain.Category, error) {
	if err := s.repo.SetYearlyBudgetEnabled(ctx, id, enabled); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	return s.repo.GetByID(ctx, id)
}

func (s *Service) List(ctx context.Context) ([]domain.Category, error) {
	return s.repo.List(ctx)
}

func (s *Service) GetByID(ctx context.Context, id uint64) (*domain.Category, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *Service) CreateSubcategory(ctx context.Context, categoryID uint64, name string) (*domain.Subcategory, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("subcategory name is required")
	}
	if len(name) > 80 {
		name = name[:80]
	}
	if _, err := s.repo.GetByID(ctx, categoryID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("category not found")
		}
		return nil, err
	}
	subcategory := &domain.Subcategory{CategoryID: categoryID, Name: name}
	if err := s.repo.CreateSubcategory(ctx, subcategory); err != nil {
		return nil, err
	}
	return subcategory, nil
}

func (s *Service) DeleteSubcategory(ctx context.Context, categoryID uint64, subcategoryID uint64) error {
	return s.repo.DeleteSubcategory(ctx, categoryID, subcategoryID)
}
