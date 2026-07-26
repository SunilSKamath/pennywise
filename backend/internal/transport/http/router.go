package http

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	applicationbudget "github.com/creation/pennywise/backend/internal/application/budget"
	applicationcategory "github.com/creation/pennywise/backend/internal/application/category"
	applicationdashboard "github.com/creation/pennywise/backend/internal/application/dashboard"
	applicationexpense "github.com/creation/pennywise/backend/internal/application/expense"
	applicationpaymentsource "github.com/creation/pennywise/backend/internal/application/paymentsource"
	expensedomain "github.com/creation/pennywise/backend/internal/domain/expense"
	householddomain "github.com/creation/pennywise/backend/internal/domain/household"
	paymentsourcedomain "github.com/creation/pennywise/backend/internal/domain/paymentsource"
	userdomain "github.com/creation/pennywise/backend/internal/domain/user"
	"github.com/creation/pennywise/backend/internal/infrastructure/oauth"
	"github.com/gofiber/fiber/v3"
	static "github.com/gofiber/fiber/v3/middleware/static"
	"go.uber.org/zap"
)

type Services struct {
	Expenses       *applicationexpense.Service
	Categories     *applicationcategory.Service
	PaymentSources *applicationpaymentsource.Service
	Dashboard      *applicationdashboard.Service
	Budgets        *applicationbudget.Service
	GoogleOAuth    *oauth.Google
	Users          userdomain.Repository
	DevAuthUserID  uint64
	JWTSecret      string
	CookieSecure   bool
	FrontendURL    string
	PublicDir      string
	Logger         *zap.Logger
}

func NewRouter(services Services) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:      "pennywise-backend",
		ErrorHandler: errorHandler,
	})

	app.Use(requestLogger(services.Logger))
	app.Get("/healthz", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	app.Get("/auth/google/login", googleLogin(services.GoogleOAuth, services.CookieSecure))
	app.Get("/auth/google/callback", googleCallback(services.GoogleOAuth, services.Users, services.JWTSecret, services.CookieSecure, services.FrontendURL))
	app.Post("/auth/logout", logout(services.CookieSecure))

	session := authMiddleware(services.Users, services.DevAuthUserID, services.JWTSecret)
	api := app.Group("/api/v1", session)
	api.Get("/me", me())
	app.Get("/me", session, me())

	protected := api.Group("", activeUser())
	protected.Get("/categories", listCategories(services.Categories))
	protected.Post("/categories", createCategory(services.Categories))
	protected.Get("/payment-sources", listPaymentSources(services.PaymentSources))
	protected.Post("/payment-sources", createPaymentSource(services.PaymentSources))
	protected.Post("/expenses", createExpense(services.Expenses))
	protected.Get("/expenses", listExpenses(services.Expenses))
	protected.Get("/expenses/:id", getExpense(services.Expenses))
	protected.Patch("/expenses/:id", updateExpense(services.Expenses))
	protected.Delete("/expenses/:id", deleteExpense(services.Expenses))
	protected.Get("/tags", listTags(services.Expenses))
	protected.Get("/dashboard", getDashboard(services.Dashboard))
	protected.Get("/budgets", listBudgets(services.Budgets))
	protected.Put("/budgets", upsertBudget(services.Budgets))
	protected.Delete("/budgets/:id", deleteBudget(services.Budgets))

	admin := protected.Group("/admin", adminOnly())
	admin.Get("/users", listUsers(services.Users))
	admin.Patch("/users/:id", updateUserAccess(services.Users))
	admin.Patch("/users/:id/households", updateUserHouseholds(services.Users))
	admin.Get("/households", listHouseholds(services.Users))
	admin.Post("/households", createHousehold(services.Users))

	app.Use("/api", missingBackendRoute())
	app.Use("/auth", missingBackendRoute())
	registerFrontend(app, services.PublicDir)

	return app
}

func missingBackendRoute() fiber.Handler {
	return func(c fiber.Ctx) error {
		return fiber.NewError(fiber.StatusNotFound, "route not found")
	}
}

func registerFrontend(app *fiber.App, publicDir string) {
	if strings.TrimSpace(publicDir) == "" {
		publicDir = "public"
	}
	indexPath := filepath.Join(publicDir, "index.html")
	serviceWorkerPath := filepath.Join(publicDir, "sw.js")
	// The browser must check this file on every launch so a repaired PWA cache
	// reaches already-installed iPhone apps promptly.
	app.Get("/sw.js", func(c fiber.Ctx) error {
		if _, err := os.Stat(serviceWorkerPath); err != nil {
			return fiber.NewError(fiber.StatusNotFound, "service worker not found")
		}
		c.Set("Cache-Control", "no-cache")
		return c.SendFile(serviceWorkerPath)
	})
	// HTML must not be served from the normal one-hour asset cache: its Vite
	// asset references change on every release.
	app.Get("/", serveFrontendIndex(indexPath))
	app.Get("/*", static.New(publicDir, static.Config{
		IndexNames: []string{"index.html"},
		MaxAge:     3600,
		Compress:   true,
		NotFoundHandler: func(c fiber.Ctx) error {
			// Only browser navigation requests are SPA routes. Returning index.html
			// for a missing .js or .css file makes Safari fail to load the app.
			if filepath.Ext(c.Path()) != "" || !strings.Contains(c.Get("Accept"), "text/html") {
				return fiber.NewError(fiber.StatusNotFound, "asset not found")
			}
			return serveFrontendIndex(indexPath)(c)
		},
	}))
}

func serveFrontendIndex(indexPath string) fiber.Handler {
	return func(c fiber.Ctx) error {
		if _, err := os.Stat(indexPath); err != nil {
			return fiber.NewError(fiber.StatusNotFound, "frontend not found")
		}
		c.Set("Cache-Control", "no-cache")
		return c.SendFile(indexPath)
	}
}

func requestLogger(logger *zap.Logger) fiber.Handler {
	return func(c fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		status := c.Response().StatusCode()
		if err != nil {
			status = fiber.StatusInternalServerError
			var fiberErr *fiber.Error
			if errors.As(err, &fiberErr) {
				status = fiberErr.Code
			}
		}
		fields := []zap.Field{
			zap.String("method", c.Method()),
			zap.String("path", c.Path()),
			zap.Int("status", status),
			zap.Duration("latency", time.Since(start)),
		}
		if err != nil {
			fields = append(fields, zap.Error(err))
			if status >= fiber.StatusInternalServerError {
				logger.Error("http_request", fields...)
			} else {
				logger.Warn("http_request", fields...)
			}
			return err
		}
		logger.Info("http_request", fields...)
		return err
	}
}

func authMiddleware(users userdomain.Repository, defaultUserID uint64, jwtSecret string) fiber.Handler {
	return func(c fiber.Ctx) error {
		userID := uint64(0)
		if token := bearerToken(c); token != "" {
			parsed, err := verifySessionToken(token, jwtSecret)
			if err != nil {
				return fiber.NewError(fiber.StatusUnauthorized, "invalid session")
			}
			userID = parsed
		}
		if userID == 0 {
			if token := c.Cookies("pennywise_session"); token != "" {
				parsed, err := verifySessionToken(token, jwtSecret)
				if err != nil {
					return fiber.NewError(fiber.StatusUnauthorized, "invalid session")
				}
				userID = parsed
			}
		}
		if header := c.Get("X-User-ID"); header != "" {
			parsed, err := strconv.ParseUint(header, 10, 64)
			if err != nil || parsed == 0 {
				return fiber.NewError(fiber.StatusUnauthorized, "invalid X-User-ID")
			}
			userID = parsed
		}
		if userID == 0 {
			userID = defaultUserID
		}
		if userID == 0 {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}
		user, err := users.GetByID(context.Background(), userID)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "user is not allowed")
		}
		c.Locals("user", user)
		return c.Next()
	}
}

func activeUser() fiber.Handler {
	return func(c fiber.Ctx) error {
		user := currentUser(c)
		if user == nil {
			return fiber.NewError(fiber.StatusUnauthorized, "authentication required")
		}
		if user.HouseholdID == 0 {
			return fiber.NewError(fiber.StatusForbidden, "user is not linked to a household")
		}
		if !userCanAccessHousehold(user, selectedHouseholdID(c, user)) {
			return fiber.NewError(fiber.StatusForbidden, "household access required")
		}
		if user.Status != userdomain.StatusActive {
			return fiber.NewError(fiber.StatusForbidden, "account is waiting for admin approval")
		}
		return c.Next()
	}
}

func adminOnly() fiber.Handler {
	return func(c fiber.Ctx) error {
		if currentUser(c).Role != userdomain.RoleAdmin {
			return fiber.NewError(fiber.StatusForbidden, "admin access required")
		}
		return c.Next()
	}
}

func googleLogin(googleOAuth *oauth.Google, cookieSecure bool) fiber.Handler {
	return func(c fiber.Ctx) error {
		state, err := randomState()
		if err != nil {
			return err
		}
		url, err := googleOAuth.LoginURL(state)
		if err != nil {
			return fiber.NewError(fiber.StatusNotImplemented, err.Error())
		}
		c.Cookie(&fiber.Cookie{
			Name:     "oauth_state",
			Value:    state,
			HTTPOnly: true,
			SameSite: "Lax",
			Secure:   cookieSecure,
			MaxAge:   600,
		})
		return c.Redirect().To(url)
	}
}

func googleCallback(googleOAuth *oauth.Google, users userdomain.Repository, jwtSecret string, cookieSecure bool, frontendURL string) fiber.Handler {
	return func(c fiber.Ctx) error {
		state := c.Query("state")
		code := c.Query("code")
		if state == "" || code == "" {
			return fiber.NewError(fiber.StatusBadRequest, "missing oauth state or code")
		}
		if cookieState := c.Cookies("oauth_state"); cookieState == "" || cookieState != state {
			return fiber.NewError(fiber.StatusBadRequest, "invalid oauth state")
		}
		user, err := googleOAuth.ExchangeProfile(context.Background(), code)
		if err != nil {
			return err
		}
		if err := users.UpsertGoogle(context.Background(), user); err != nil {
			return err
		}
		token, err := signSessionToken(user.ID, jwtSecret, time.Now().Add(30*24*time.Hour))
		if err != nil {
			return err
		}
		c.Cookie(&fiber.Cookie{
			Name:     "pennywise_session",
			Value:    token,
			HTTPOnly: true,
			SameSite: "Lax",
			Secure:   cookieSecure,
			MaxAge:   30 * 24 * 60 * 60,
		})
		redirectURL := "/"
		if strings.TrimSpace(frontendURL) != "" {
			redirectURL = strings.TrimRight(frontendURL, "/") + "/"
		}
		return c.Redirect().To(redirectURL)
	}
}

func logout(cookieSecure bool) fiber.Handler {
	return func(c fiber.Ctx) error {
		c.Cookie(&fiber.Cookie{
			Name:     "pennywise_session",
			Value:    "",
			HTTPOnly: true,
			SameSite: "Lax",
			Secure:   cookieSecure,
			MaxAge:   -1,
		})
		return c.SendStatus(fiber.StatusNoContent)
	}
}

func me() fiber.Handler {
	return func(c fiber.Ctx) error {
		return c.JSON(currentUser(c))
	}
}

func listUsers(users userdomain.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		result, err := users.ListByHousehold(context.Background(), currentUser(c).HouseholdID)
		if err != nil {
			return err
		}
		return c.JSON(result)
	}
}

func updateUserAccess(users userdomain.Repository) fiber.Handler {
	type request struct {
		Role   userdomain.Role   `json:"role"`
		Status userdomain.Status `json:"status"`
	}
	return func(c fiber.Ctx) error {
		id, err := pathID(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		if id == currentUser(c).ID && req.Status != userdomain.StatusActive {
			return fiber.NewError(fiber.StatusBadRequest, "you cannot deactivate your own account")
		}
		updated, err := users.UpdateAccess(context.Background(), id, currentUser(c).HouseholdID, req.Role, req.Status)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.JSON(updated)
	}
}

func updateUserHouseholds(users userdomain.Repository) fiber.Handler {
	type request struct {
		HouseholdIDs []uint64 `json:"household_ids"`
	}
	return func(c fiber.Ctx) error {
		id, err := pathID(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		updated, err := users.SetHouseholdAccess(context.Background(), id, req.HouseholdIDs)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.JSON(updated)
	}
}

func listHouseholds(users userdomain.Repository) fiber.Handler {
	return func(c fiber.Ctx) error {
		households, err := users.ListHouseholds(context.Background())
		if err != nil {
			return err
		}
		return c.JSON(households)
	}
}

func createHousehold(users userdomain.Repository) fiber.Handler {
	type request struct {
		Name             string `json:"name"`
		BaseCurrencyCode string `json:"base_currency_code"`
	}
	return func(c fiber.Ctx) error {
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		household := &householddomain.Household{
			Name:             strings.TrimSpace(req.Name),
			BaseCurrencyCode: strings.ToUpper(strings.TrimSpace(req.BaseCurrencyCode)),
		}
		if household.Name == "" {
			return fiber.NewError(fiber.StatusBadRequest, "household name is required")
		}
		if len(household.BaseCurrencyCode) != 3 {
			return fiber.NewError(fiber.StatusBadRequest, "base currency code must be 3 letters")
		}
		if err := users.CreateHousehold(context.Background(), household); err != nil {
			return err
		}
		if _, err := users.SetHouseholdAccess(context.Background(), currentUser(c).ID, append(currentUserHouseholdIDs(c), household.ID)); err != nil {
			return err
		}
		return c.Status(fiber.StatusCreated).JSON(household)
	}
}

func listCategories(service *applicationcategory.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		categories, err := service.List(context.Background())
		if err != nil {
			return err
		}
		return c.JSON(categories)
	}
}

func createCategory(service *applicationcategory.Service) fiber.Handler {
	type request struct {
		Name  string `json:"name"`
		Emoji string `json:"emoji"`
	}
	return func(c fiber.Ctx) error {
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		category, err := service.Create(context.Background(), req.Name, req.Emoji)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(category)
	}
}

func listPaymentSources(service *applicationpaymentsource.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		paymentSources, err := service.List(context.Background())
		if err != nil {
			return err
		}
		return c.JSON(paymentSources)
	}
}

func createPaymentSource(service *applicationpaymentsource.Service) fiber.Handler {
	type request struct {
		Name         string                   `json:"name"`
		Type         paymentsourcedomain.Type `json:"type"`
		CurrencyCode string                   `json:"currency_code"`
	}
	return func(c fiber.Ctx) error {
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		paymentSource, err := service.Create(context.Background(), applicationpaymentsource.CreateInput{
			Name:         req.Name,
			Type:         req.Type,
			CurrencyCode: req.CurrencyCode,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(paymentSource)
	}
}

func createExpense(service *applicationexpense.Service) fiber.Handler {
	type request struct {
		OriginalAmountMinor  int64    `json:"original_amount_minor"`
		OriginalCurrencyCode string   `json:"original_currency_code"`
		CategoryID           uint64   `json:"category_id"`
		PaymentSourceID      uint64   `json:"payment_source_id"`
		Merchant             string   `json:"merchant"`
		Notes                string   `json:"notes"`
		ExpenseDate          string   `json:"expense_date"`
		MetadataJSON         string   `json:"metadata_json"`
		Tags                 []string `json:"tags"`
	}
	return func(c fiber.Ctx) error {
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		expenseDate, err := parseOptionalDate(req.ExpenseDate)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		expense, err := service.Create(context.Background(), applicationexpense.CreateInput{
			OriginalAmountMinor:  req.OriginalAmountMinor,
			OriginalCurrencyCode: req.OriginalCurrencyCode,
			CategoryID:           req.CategoryID,
			PaymentSourceID:      req.PaymentSourceID,
			Merchant:             req.Merchant,
			Notes:                req.Notes,
			ExpenseDate:          expenseDate,
			CreatedBy:            currentUser(c).ID,
			HouseholdID:          currentHouseholdID(c),
			MetadataJSON:         req.MetadataJSON,
			Tags:                 req.Tags,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.Status(fiber.StatusCreated).JSON(expense)
	}
}

func listExpenses(service *applicationexpense.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		filter, err := parseExpenseFilter(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		householdID := currentHouseholdID(c)
		filter.HouseholdID = &householdID
		expenses, err := service.List(context.Background(), filter)
		if err != nil {
			return err
		}
		return c.JSON(expenses)
	}
}

func getExpense(service *applicationexpense.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := pathID(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		expense, err := service.GetByID(context.Background(), id, currentHouseholdID(c))
		if err != nil {
			return fiber.NewError(fiber.StatusNotFound, "expense not found")
		}
		return c.JSON(expense)
	}
}

func updateExpense(service *applicationexpense.Service) fiber.Handler {
	type request struct {
		OriginalAmountMinor  *int64    `json:"original_amount_minor"`
		OriginalCurrencyCode *string   `json:"original_currency_code"`
		CategoryID           *uint64   `json:"category_id"`
		PaymentSourceID      *uint64   `json:"payment_source_id"`
		Merchant             *string   `json:"merchant"`
		Notes                *string   `json:"notes"`
		ExpenseDate          *string   `json:"expense_date"`
		MetadataJSON         *string   `json:"metadata_json"`
		Tags                 *[]string `json:"tags"`
	}
	return func(c fiber.Ctx) error {
		id, err := pathID(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		expenseDate, err := parseOptionalDatePointer(req.ExpenseDate)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		expense, err := service.Update(context.Background(), applicationexpense.UpdateInput{
			ID:                   id,
			HouseholdID:          currentHouseholdID(c),
			OriginalAmountMinor:  req.OriginalAmountMinor,
			OriginalCurrencyCode: req.OriginalCurrencyCode,
			CategoryID:           req.CategoryID,
			PaymentSourceID:      req.PaymentSourceID,
			Merchant:             req.Merchant,
			Notes:                req.Notes,
			ExpenseDate:          expenseDate,
			MetadataJSON:         req.MetadataJSON,
			Tags:                 req.Tags,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.JSON(expense)
	}
}

func listTags(service *applicationexpense.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		tags, err := service.ListTags(context.Background(), currentHouseholdID(c), c.Query("search", c.Query("q")))
		if err != nil {
			return err
		}
		return c.JSON(tags)
	}
}

func deleteExpense(service *applicationexpense.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := pathID(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		if err := service.Delete(context.Background(), id, currentHouseholdID(c)); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

func getDashboard(service *applicationdashboard.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		month := time.Now()
		if value := c.Query("month"); value != "" {
			parsed, err := time.Parse("2006-01", value)
			if err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "month must use YYYY-MM")
			}
			month = parsed
		}
		summary, err := service.Get(context.Background(), month, currentHouseholdID(c))
		if err != nil {
			return err
		}
		return c.JSON(summary)
	}
}

func listBudgets(service *applicationbudget.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		month := time.Now().Format("2006-01")
		if value := c.Query("month"); value != "" {
			if _, err := time.Parse("2006-01", value); err != nil {
				return fiber.NewError(fiber.StatusBadRequest, "month must use YYYY-MM")
			}
			month = value
		}
		budgets, err := service.ListWithProgress(context.Background(), currentHouseholdID(c), month)
		if err != nil {
			return err
		}
		return c.JSON(budgets)
	}
}

func upsertBudget(service *applicationbudget.Service) fiber.Handler {
	type request struct {
		CategoryID   uint64 `json:"category_id"`
		Month        string `json:"month"`
		AmountMinor  int64  `json:"amount_minor"`
		CurrencyCode string `json:"currency_code"`
	}
	return func(c fiber.Ctx) error {
		var req request
		if err := c.Bind().Body(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		budget, err := service.Upsert(context.Background(), applicationbudget.UpsertInput{
			HouseholdID:  currentHouseholdID(c),
			CategoryID:   req.CategoryID,
			Month:        req.Month,
			AmountMinor:  req.AmountMinor,
			CurrencyCode: req.CurrencyCode,
		})
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		return c.JSON(budget)
	}
}

func deleteBudget(service *applicationbudget.Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		id, err := pathID(c)
		if err != nil {
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		}
		if err := service.Delete(context.Background(), id, currentHouseholdID(c)); err != nil {
			return err
		}
		return c.SendStatus(fiber.StatusNoContent)
	}
}

func parseExpenseFilter(c fiber.Ctx) (expensedomain.Filter, error) {
	var filter expensedomain.Filter
	if value := c.Query("date_from"); value != "" {
		parsed, err := parseDate(value)
		if err != nil {
			return filter, err
		}
		filter.DateFrom = &parsed
	}
	if value := c.Query("date_to"); value != "" {
		parsed, err := parseDate(value)
		if err != nil {
			return filter, err
		}
		exclusive := parsed.AddDate(0, 0, 1)
		filter.DateTo = &exclusive
	}
	if value := c.Query("category_id"); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return filter, errors.New("category_id must be an integer")
		}
		filter.CategoryID = &parsed
	}
	if value := c.Query("payment_source_id"); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return filter, errors.New("payment_source_id must be an integer")
		}
		filter.PaymentSourceID = &parsed
	}
	if value := strings.TrimSpace(c.Query("search", c.Query("q"))); value != "" {
		filter.Search = value
	}
	if value := strings.TrimSpace(c.Query("tags", c.Query("tag"))); value != "" {
		for _, tag := range strings.Split(value, ",") {
			if tag = strings.TrimSpace(tag); tag != "" {
				filter.Tags = append(filter.Tags, tag)
			}
		}
	}
	if value := c.Query("limit"); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return filter, errors.New("limit must be an integer")
		}
		filter.Limit = parsed
	}
	if value := c.Query("offset"); value != "" {
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return filter, errors.New("offset must be an integer")
		}
		filter.Offset = parsed
	}
	return filter, nil
}

func pathID(c fiber.Ctx) (uint64, error) {
	id, err := strconv.ParseUint(c.Params("id"), 10, 64)
	if err != nil || id == 0 {
		return 0, errors.New("id must be a positive integer")
	}
	return id, nil
}

func currentUser(c fiber.Ctx) *userdomain.User {
	user, _ := c.Locals("user").(*userdomain.User)
	return user
}

func currentHouseholdID(c fiber.Ctx) uint64 {
	return selectedHouseholdID(c, currentUser(c))
}

func selectedHouseholdID(c fiber.Ctx, user *userdomain.User) uint64 {
	if user == nil {
		return 0
	}
	if header := c.Get("X-Household-ID"); header != "" {
		parsed, err := strconv.ParseUint(header, 10, 64)
		if err == nil && parsed > 0 {
			return parsed
		}
	}
	return user.HouseholdID
}

func userCanAccessHousehold(user *userdomain.User, householdID uint64) bool {
	if user == nil || householdID == 0 {
		return false
	}
	if user.HouseholdID == householdID {
		return true
	}
	for _, household := range user.Households {
		if household.ID == householdID {
			return true
		}
	}
	return false
}

func currentUserHouseholdIDs(c fiber.Ctx) []uint64 {
	user := currentUser(c)
	ids := []uint64{}
	for _, household := range user.Households {
		ids = append(ids, household.ID)
	}
	if len(ids) == 0 && user.HouseholdID != 0 {
		ids = append(ids, user.HouseholdID)
	}
	return ids
}

func bearerToken(c fiber.Ctx) string {
	header := c.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, "Bearer "))
}

func parseOptionalDate(value string) (time.Time, error) {
	if value == "" {
		return time.Time{}, nil
	}
	return parseDate(value)
}

func parseOptionalDatePointer(value *string) (*time.Time, error) {
	if value == nil || *value == "" {
		return nil, nil
	}
	parsed, err := parseDate(*value)
	if err != nil {
		return nil, err
	}
	return &parsed, nil
}

func parseDate(value string) (time.Time, error) {
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return parsed, nil
	}
	parsed, err := time.Parse("2006-01-02", value)
	if err != nil {
		return time.Time{}, errors.New("date must use YYYY-MM-DD or RFC3339")
	}
	return parsed, nil
}

func randomState() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

type sessionClaims struct {
	Sub uint64 `json:"sub"`
	Exp int64  `json:"exp"`
}

func signSessionToken(userID uint64, secret string, expiresAt time.Time) (string, error) {
	header, err := encodeJSON(fiber.Map{"alg": "HS256", "typ": "JWT"})
	if err != nil {
		return "", err
	}
	claims, err := encodeJSON(sessionClaims{Sub: userID, Exp: expiresAt.Unix()})
	if err != nil {
		return "", err
	}
	unsigned := header + "." + claims
	signature := sign(unsigned, secret)
	return unsigned + "." + signature, nil
}

func verifySessionToken(token string, secret string) (uint64, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return 0, errors.New("invalid token")
	}
	expected := sign(parts[0]+"."+parts[1], secret)
	if !hmac.Equal([]byte(expected), []byte(parts[2])) {
		return 0, errors.New("invalid signature")
	}
	claimsBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return 0, err
	}
	var claims sessionClaims
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return 0, err
	}
	if claims.Sub == 0 || time.Now().Unix() > claims.Exp {
		return 0, errors.New("expired token")
	}
	return claims.Sub, nil
}

func encodeJSON(value any) (string, error) {
	bytes, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func sign(unsigned string, secret string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(unsigned))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func errorHandler(c fiber.Ctx, err error) error {
	status := fiber.StatusInternalServerError
	message := "internal server error"
	var fiberErr *fiber.Error
	if errors.As(err, &fiberErr) {
		status = fiberErr.Code
		message = fiberErr.Message
	}
	return c.Status(status).JSON(fiber.Map{"error": message})
}
