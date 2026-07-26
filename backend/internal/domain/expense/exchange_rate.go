package expense

import (
	"context"

	"github.com/shopspring/decimal"
)

type ConversionResult struct {
	OriginalAmountMinor   int64
	OriginalCurrencyCode  string
	ConvertedAmountMinor  int64
	ConvertedCurrencyCode string
	ExchangeRate          decimal.Decimal
}

type ExchangeRateProvider interface {
	Convert(ctx context.Context, amountMinor int64, from string, to string) (ConversionResult, error)
}
