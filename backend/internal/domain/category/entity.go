package category

type Subcategory struct {
	ID         uint64 `json:"id"`
	CategoryID uint64 `json:"-"`
	Name       string `json:"name"`
	Deleted    bool   `json:"deleted,omitempty"`
}

type Category struct {
	ID                  uint64        `json:"id"`
	Name                string        `json:"name"`
	Emoji               string        `json:"emoji"`
	YearlyBudgetEnabled bool          `json:"yearly_budget_enabled"`
	Subcategories       []Subcategory `json:"subcategories"`
}
