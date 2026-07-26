package budget

import "time"

type Budget struct {
	ID           uint64    `json:"id"`
	HouseholdID  uint64    `json:"household_id"`
	CategoryID   uint64    `json:"category_id"`
	Month        string    `json:"month"`
	AmountMinor  int64     `json:"amount_minor"`
	CurrencyCode string    `json:"currency_code"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type WithProgress struct {
	Budget
	SpentMinor int64 `json:"spent_minor"`
}
