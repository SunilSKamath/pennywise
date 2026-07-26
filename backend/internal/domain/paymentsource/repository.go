package paymentsource

import "context"

type Repository interface {
	Create(ctx context.Context, paymentSource *PaymentSource) error
	GetByID(ctx context.Context, id uint64) (*PaymentSource, error)
	List(ctx context.Context) ([]PaymentSource, error)
}
