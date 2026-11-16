package paymentsource

type Type string

const (
	TypeBankAccount Type = "bank_account"
	TypeCreditCard  Type = "credit_card"
	TypeUPI         Type = "upi"
	TypeCash        Type = "cash"
	TypeOther       Type = "other"
)

type PaymentSource struct {
	ID           uint64 `json:"id"`
	HouseholdID  uint64 `json:"household_id,omitempty"`
	Name         string `json:"name"`
	Type         Type   `json:"type"`
	CurrencyCode string `json:"currency_code"`
}
