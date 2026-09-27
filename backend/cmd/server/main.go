package main

import (
	"context"
	"os/signal"
	"syscall"

	applicationbudget "github.com/creation/pennywise/backend/internal/application/budget"
	applicationcategory "github.com/creation/pennywise/backend/internal/application/category"
	applicationdashboard "github.com/creation/pennywise/backend/internal/application/dashboard"
	applicationexpense "github.com/creation/pennywise/backend/internal/application/expense"
	applicationpaymentsource "github.com/creation/pennywise/backend/internal/application/paymentsource"
	"github.com/creation/pennywise/backend/internal/infrastructure/exchangerate"
	"github.com/creation/pennywise/backend/internal/infrastructure/mysql"
	"github.com/creation/pennywise/backend/internal/infrastructure/oauth"
	"github.com/creation/pennywise/backend/internal/platform/config"
	"github.com/creation/pennywise/backend/internal/platform/database"
	"github.com/creation/pennywise/backend/internal/platform/logger"
	transporthttp "github.com/creation/pennywise/backend/internal/transport/http"
	"go.uber.org/zap"
)

func main() {
	cfg := config.Load()
	log, err := logger.New(cfg.AppEnv)
	if err != nil {
		panic(err)
	}
	defer log.Sync()
	if cfg.AdminEmail == "" {
		log.Fatal("ADMIN_EMAIL is required")
	}
	if !cfg.ValidJWTSecret() {
		log.Fatal("JWT_SECRET must be set to a unique value")
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := database.Open(ctx, cfg.DatabaseDSN)
	if err != nil {
		log.Fatal("open database", zap.Error(err))
	}
	defer db.Close()
	if err := mysql.EnsureDefaults(ctx, db); err != nil {
		log.Fatal("ensure default data", zap.Error(err))
	}

	categoryRepo := mysql.NewCategoryRepository(db)
	paymentSourceRepo := mysql.NewPaymentSourceRepository(db)
	expenseRepo := mysql.NewExpenseRepository(db)
	budgetRepo := mysql.NewBudgetRepository(db)
	userRepo := mysql.NewUserRepository(db, cfg.AdminEmail)
	rateProvider := exchangerate.NewProvider(cfg.ExchangeRateAPIURL)

	categoryService := applicationcategory.NewService(categoryRepo)
	paymentSourceService := applicationpaymentsource.NewService(paymentSourceRepo)
	expenseService := applicationexpense.NewService(
		expenseRepo,
		categoryRepo,
		paymentSourceRepo,
		rateProvider,
		cfg.HouseholdBaseCurrency,
	)
	dashboardService := applicationdashboard.NewService(expenseRepo)
	budgetService := applicationbudget.NewService(budgetRepo, expenseRepo, categoryRepo)

	app := transporthttp.NewRouter(transporthttp.Services{
		Expenses:       expenseService,
		Categories:     categoryService,
		PaymentSources: paymentSourceService,
		Dashboard:      dashboardService,
		Budgets:        budgetService,
		GoogleOAuth:    oauth.NewGoogle(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.GoogleRedirectURL),
		Users:          userRepo,
		JWTSecret:      cfg.JWTSecret,
		CookieSecure:   cfg.CookieSecure,
		CookieSameSite: cfg.CookieSameSite,
		FrontendURL:    cfg.FrontendURL,
		PublicDir:      cfg.PublicDir,
		Logger:         log,
	})

	serverErr := make(chan error, 1)
	go func() {
		log.Info("starting server", zap.String("addr", cfg.HTTPAddr))
		serverErr <- app.Listen(cfg.HTTPAddr)
	}()

	select {
	case <-ctx.Done():
		if err := app.Shutdown(); err != nil {
			log.Error("shutdown server", zap.Error(err))
		}
	case err := <-serverErr:
		log.Fatal("server stopped", zap.Error(err))
	}
}
