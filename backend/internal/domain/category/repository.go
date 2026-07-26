package category

import "context"

type Repository interface {
	Create(ctx context.Context, category *Category) error
	GetByID(ctx context.Context, id uint64) (*Category, error)
	List(ctx context.Context) ([]Category, error)
}
