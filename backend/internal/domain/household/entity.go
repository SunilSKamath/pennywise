package household

type Household struct {
	ID               uint64 `json:"id"`
	Name             string `json:"name"`
	BaseCurrencyCode string `json:"base_currency_code"`
}
