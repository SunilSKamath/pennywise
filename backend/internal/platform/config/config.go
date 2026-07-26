package config

import (
	"os"
	"strconv"
	"strings"
)

type Config struct {
	AppEnv                string
	HTTPAddr              string
	DatabaseDSN           string
	HouseholdID           uint64
	HouseholdBaseCurrency string
	DevAuthUserID         uint64
	GoogleClientID        string
	GoogleClientSecret    string
	GoogleRedirectURL     string
	FrontendURL           string
	PublicDir             string
	AdminEmail            string
	JWTSecret             string
	CookieSecure          bool
	ExchangeRateAPIURL    string
}

func Load() Config {
	loadEnvFile(".env")

	return Config{
		AppEnv:                env("APP_ENV", "development"),
		HTTPAddr:              env("HTTP_ADDR", ":8080"),
		DatabaseDSN:           env("DATABASE_DSN", "pennywise:pennywise@tcp(127.0.0.1:3306)/pennywise?parseTime=true&multiStatements=true"),
		HouseholdID:           envUint("HOUSEHOLD_ID", 1),
		HouseholdBaseCurrency: strings.ToUpper(env("HOUSEHOLD_BASE_CURRENCY", "INR")),
		DevAuthUserID:         envUint("DEV_AUTH_USER_ID", 0),
		GoogleClientID:        env("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret:    env("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURL:     env("GOOGLE_REDIRECT_URL", "http://localhost:8080/auth/google/callback"),
		FrontendURL:           env("FRONTEND_URL", ""),
		PublicDir:             env("PUBLIC_DIR", "public"),
		AdminEmail:            strings.ToLower(strings.TrimSpace(env("ADMIN_EMAIL", env("admin_email", "")))),
		JWTSecret:             env("JWT_SECRET", "change-me"),
		CookieSecure:          envBool("COOKIE_SECURE", false),
		ExchangeRateAPIURL:    env("EXCHANGE_RATE_API_URL", "https://open.er-api.com/v6/latest"),
	}
}

func loadEnvFile(path string) {
	content, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(content), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" {
			continue
		}
		if _, exists := os.LookupEnv(key); !exists {
			os.Setenv(key, value)
		}
	}
}

func env(key string, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

func envUint(key string, fallback uint64) uint64 {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

func envBool(key string, fallback bool) bool {
	value, ok := os.LookupEnv(key)
	if !ok || strings.TrimSpace(value) == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
