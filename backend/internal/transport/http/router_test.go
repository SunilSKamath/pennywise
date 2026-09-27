package http

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/creation/pennywise/backend/internal/platform/config"
	"go.uber.org/zap"
)

func TestUserIDHeaderDoesNotAuthenticate(t *testing.T) {
	app := NewRouter(Services{
		Logger:         zap.NewNop(),
		JWTSecret:      "test-secret-value",
		CookieSameSite: "Lax",
		PublicDir:      t.TempDir(),
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/me", nil)
	req.Header.Set("X-User-ID", "1")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestClientRouteWithoutHTMLAcceptServesIndex(t *testing.T) {
	dir := t.TempDir()
	index := "<!doctype html><div id=\"root\"></div>"
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(index), 0o644); err != nil {
		t.Fatal(err)
	}
	app := NewRouter(Services{
		Logger:         zap.NewNop(),
		JWTSecret:      "test-secret-value",
		CookieSameSite: "Lax",
		PublicDir:      dir,
	})

	req := httptest.NewRequest(http.MethodGet, "/dashboard", nil)
	req.Header.Set("Accept", "*/*")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(body), `id="root"`) {
		t.Fatalf("body = %q, want index.html", body)
	}
}

func TestMissingAssetDoesNotServeIndex(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<!doctype html>"), 0o644); err != nil {
		t.Fatal(err)
	}
	app := NewRouter(Services{
		Logger:         zap.NewNop(),
		JWTSecret:      "test-secret-value",
		CookieSameSite: "Lax",
		PublicDir:      dir,
	})

	req := httptest.NewRequest(http.MethodGet, "/assets/missing.js", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestJWTSecretRejectsDefault(t *testing.T) {
	if (config.Config{JWTSecret: ""}).ValidJWTSecret() {
		t.Fatal("empty JWT secret was accepted")
	}
	if (config.Config{JWTSecret: "change-me"}).ValidJWTSecret() {
		t.Fatal("default JWT secret was accepted")
	}
	if !(config.Config{JWTSecret: "a-real-secret"}).ValidJWTSecret() {
		t.Fatal("non-default JWT secret was rejected")
	}
}
