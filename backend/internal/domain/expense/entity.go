package expense

import (
	"time"

	"github.com/shopspring/decimal"
)

type Expense struct {
	ID                    uint64          `json:"id"`
	HouseholdID           uint64          `json:"household_id"`
	OriginalAmountMinor   int64           `json:"original_amount_minor"`
	OriginalCurrencyCode  string          `json:"original_currency_code"`
	ConvertedAmountMinor  int64           `json:"converted_amount_minor"`
	ConvertedCurrencyCode string          `json:"converted_currency_code"`
	ExchangeRate          decimal.Decimal `json:"exchange_rate"`
	CategoryID            uint64          `json:"category_id"`
	PaymentSourceID       uint64          `json:"payment_source_id"`
	Merchant              string          `json:"merchant"`
	Notes                 string          `json:"notes"`
	ExpenseDate           time.Time       `json:"expense_date"`
	CreatedBy             uint64          `json:"created_by"`
	MetadataJSON          string          `json:"metadata_json"`
	Tags                  []string        `json:"tags"`
	CreatedAt             time.Time       `json:"created_at"`
	UpdatedAt             time.Time       `json:"updated_at"`
}

type Filter struct {
	DateFrom        *time.Time
	DateTo          *time.Time
	CategoryID      *uint64
	PaymentSourceID *uint64
	HouseholdID     *uint64
	Search          string
	Tags            []string
	Limit           uint64
	Offset          uint64
}

type SummaryRow struct {
	ID               uint64 `json:"id"`
	Name             string `json:"name"`
	AmountMinor      int64  `json:"amount_minor"`
	TransactionCount int64  `json:"transaction_count"`
	CurrencyCode     string `json:"currency_code"`
}

type Tag struct {
	ID          uint64 `json:"id"`
	HouseholdID uint64 `json:"household_id"`
	Name        string `json:"name"`
}
