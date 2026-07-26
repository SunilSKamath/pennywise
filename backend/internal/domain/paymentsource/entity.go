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
	Name         string `json:"name"`
	Type         Type   `json:"type"`
	CurrencyCode string `json:"currency_code"`
}
