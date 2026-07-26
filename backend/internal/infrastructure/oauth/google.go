package oauth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	userdomain "github.com/creation/pennywise/backend/internal/domain/user"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

type Google struct {
	config *oauth2.Config
}

func NewGoogle(clientID string, clientSecret string, redirectURL string) *Google {
	return &Google{
		config: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		},
	}
}

func (g *Google) LoginURL(state string) (string, error) {
	if g.config.ClientID == "" || g.config.ClientSecret == "" {
		return "", errors.New("google oauth is not configured")
	}
	return g.config.AuthCodeURL(state, oauth2.AccessTypeOffline), nil
}

func (g *Google) ExchangeProfile(ctx context.Context, code string) (*userdomain.User, error) {
	if g.config.ClientID == "" || g.config.ClientSecret == "" {
		return nil, errors.New("google oauth is not configured")
	}
	token, err := g.config.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	client := g.config.Client(ctx, token)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://openidconnect.googleapis.com/v1/userinfo", nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("google userinfo returned status %d", resp.StatusCode)
	}

	var profile struct {
		Subject string `json:"sub"`
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, err
	}
	if profile.Subject == "" || profile.Email == "" {
		return nil, errors.New("google profile is missing subject or email")
	}
	return &userdomain.User{
		HouseholdID: 1,
		GoogleID:    profile.Subject,
		Email:       profile.Email,
		Name:        profile.Name,
		PictureURL:  profile.Picture,
	}, nil
}
