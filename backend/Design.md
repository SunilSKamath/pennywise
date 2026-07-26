# Family Finance Hub - Backend Architecture v1

## Goal

A self-hosted family expense tracking application designed for:

* Personal use by a couple
* Self-hosted on a home server
* Mobile-first usage
* Google OAuth authentication
* Multi-currency expense tracking
* Future support for AI-powered categorization and Gmail ingestion

The system should remain simple enough for daily use while providing a strong foundation for future expansion.

---

# Technology Stack

## Backend

### Language

Go 1.25+

Reason:

* High familiarity
* Excellent deployment characteristics
* Single binary
* Strong concurrency model

### HTTP Framework

Fiber v3

Reason:

* Fast
* Minimal
* Familiar

### Database

MySQL 8+

Reason:

* Existing expertise
* Already used in other projects
* Mature ecosystem

### Authentication

Google OAuth (OIDC)

Reason:

* No password management
* Strong security
* Familiar user experience

### ORM / Persistence

sqlc + database/sql

Avoid GORM.

Reason:

* Compile-time query safety
* Better performance
* Explicit SQL
* Easier debugging

### Migrations

golang-migrate

### Logging

zap

Structured JSON logging.

### Configuration

env variables

### Containerization

Docker
Docker Compose

---

# Architecture Style

Clean Architecture

```text
HTTP
 ↓
Handler
 ↓
Use Case
 ↓
Repository Interface
 ↓
Repository Implementation
 ↓
MySQL
```

Dependency direction:

```text
Infrastructure
     ↓
Application
     ↓
Domain
```

Domain never depends on infrastructure.

---

# Project Structure

```text
cmd/
  server/

internal/

  domain/

    expense/
      entity.go
      repository.go

    category/
      entity.go
      repository.go

    paymentsource/
      entity.go
      repository.go

    user/
      entity.go
      repository.go

  application/

    expense/

      create_expense.go
      update_expense.go
      delete_expense.go
      list_expenses.go

    dashboard/

      get_dashboard.go

  transport/

    http/

      expense_handler.go
      category_handler.go
      dashboard_handler.go

  infrastructure/

    mysql/

      expense_repository.go
      category_repository.go

    oauth/

    exchangerate/

pkg/

configs/

migrations/
```

---

# Domain Model

## Household

Represents a logical finance group.

Currently only one household.

```go
type Household struct {
    ID uint64

    Name string

    BaseCurrencyCode string
}
```

Example:

```text
Kamath Family
INR
```

---

# User

```go
type User struct {
    ID uint64

    GoogleID string

    Email string

    Name string

    PictureURL string
}
```

---

# Category

```go
type Category struct {
    ID uint64

    Name string
}
```

Examples:

* Food
* Travel
* Shopping
* Bills

---

# Payment Source

Represents where money came from.

```go
type PaymentSource struct {
    ID uint64

    Name string

    Type PaymentSourceType

    CurrencyCode string
}
```

Examples:

* HDFC Regalia
* Google Pay
* Cash
* SBI Savings

---

# Expense

Core entity.

```go
type Expense struct {
    ID uint64

    OriginalAmountMinor int64

    OriginalCurrencyCode string

    ConvertedAmountMinor int64

    ConvertedCurrencyCode string

    ExchangeRate decimal.Decimal

    CategoryID uint64

    PaymentSourceID uint64

    Merchant string

    Notes string

    ExpenseDate time.Time

    CreatedBy uint64
}
```

---

# Currency Design

All household reporting happens in household currency.

Example:

```text
Expense entered

100 USD

Rate
86.5

Stored

Original:
100 USD

Converted:
8650 INR
```

Historical rates never change.

---

# Database Schema

## households

```sql
id
name
base_currency_code

created_at
updated_at
```

---

## users

```sql
id

google_id
email

name
picture_url

created_at
updated_at
```

---

## categories

```sql
id

name

created_at
updated_at
deleted_at
```

---

## payment_sources

```sql
id

name

type

currency_code

created_at
updated_at
deleted_at
```

---

## expenses

```sql
id

original_amount_minor
original_currency_code

converted_amount_minor
converted_currency_code

exchange_rate

category_id
payment_source_id

merchant
notes

expense_date

created_by

metadata_json

created_at
updated_at
deleted_at
```

---

# Repository Interfaces

Expense Repository

```go
type ExpenseRepository interface {

    Create(
        ctx context.Context,
        expense Expense,
    ) error

    Update(
        ctx context.Context,
        expense Expense,
    ) error

    Delete(
        ctx context.Context,
        id uint64,
    ) error

    GetByID(
        ctx context.Context,
        id uint64,
    ) (*Expense, error)

    List(
        ctx context.Context,
        filter ExpenseFilter,
    ) ([]Expense, error)
}
```

---

# Phase 1 Use Cases

## Create Expense

Responsibilities:

* Validate category
* Validate payment source
* Convert currency
* Persist expense

---

## Update Expense

Responsibilities:

* Validate ownership
* Recalculate conversion if amount changed

---

## Delete Expense

Soft delete.

---

## List Expenses

Filters:

* Date range
* Category
* Payment source

---

## Dashboard Summary

Returns:

```json
{
  "month_total": 42000,

  "by_category": [],

  "by_payment_source": []
}
```

---

# Exchange Rate Service

Abstraction:

```go
type ExchangeRateProvider interface {

    Convert(
        ctx context.Context,

        amount decimal.Decimal,

        from string,

        to string,
    ) (ConversionResult, error)
}
```

Phase 1:

Use a free exchange-rate API.

Store conversion result permanently.

---

# HTTP API

## Authentication

```http
GET /auth/google/login

GET /auth/google/callback

GET /me
```

---

## Expenses

```http
POST   /api/v1/expenses

GET    /api/v1/expenses

GET    /api/v1/expenses/:id

PATCH  /api/v1/expenses/:id

DELETE /api/v1/expenses/:id
```

---

## Categories

```http
GET /api/v1/categories

POST /api/v1/categories
```

---

## Payment Sources

```http
GET /api/v1/payment-sources

POST /api/v1/payment-sources
```

---

## Dashboard

```http
GET /api/v1/dashboard
```

---

# Non Functional Requirements

## Performance

Target:

* p95 < 100ms

for standard CRUD APIs.

---

## Observability

OpenTelemetry

Metrics:

* Request latency
* Request count
* Error count

Logs:

* Structured JSON

Tracing:

* OTel

---

## Security

Google OAuth only.

No password storage.

JWT session cookie.

HTTPS only.

---

# Future Roadmap

Phase 2

* Recurring expenses
* Budget tracking
* Merchant suggestions

Phase 3

* Gmail ingestion
* Expense auto-detection
* AI categorization

Phase 4

* Investment tracking
* Net worth dashboard
* Subscription management
* AI financial insights

```
```
