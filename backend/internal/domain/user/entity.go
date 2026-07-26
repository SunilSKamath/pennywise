package user

import householddomain "github.com/creation/pennywise/backend/internal/domain/household"

type Role string

const (
	RoleAdmin Role = "admin"
	RoleUser  Role = "user"
)

type Status string

const (
	StatusPending Status = "pending"
	StatusActive  Status = "active"
)

type User struct {
	ID          uint64 `json:"id"`
	HouseholdID uint64 `json:"household_id"`
	GoogleID    string `json:"google_id"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	PictureURL  string `json:"picture_url"`
	Role        Role   `json:"role"`
	Status      Status `json:"status"`
	Households  []householddomain.Household `json:"households"`
}
