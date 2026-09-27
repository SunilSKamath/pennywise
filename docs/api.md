# Pennywise API

The frontend in `frontend/src/lib/api.ts` calls this contract. The backend can serve the built frontend from `PUBLIC_DIR`, or the frontend can run on another origin.

Base URL for JSON routes: `/api/v1`.

Amounts are integers in minor currency units. `100` in `INR` is one rupee.

## Hosting the frontend separately

Set `VITE_API_BASE_URL` to the API origin, for example `https://api.example.com`. Leave it empty when the Vite dev server proxies `/api` and `/auth` to the API, or when the API serves the frontend on the same origin.

On the API, set `FRONTEND_URL` to the frontend origin, for example `https://app.example.com`. That origin is the only value allowed by CORS. Credentialed requests are allowed. A wildcard origin is not.

The session cookie is `SameSite=Lax` by default. That is sent on same-site requests, including localhost on another port. When the frontend is on a different site, set:

```env
COOKIE_SAMESITE=none
COOKIE_SECURE=true
```

`COOKIE_SECURE` is also forced on when `APP_ENV=production` or `FRONTEND_URL` starts with `https://`.

## Authentication

JSON routes require one of:

- Cookie `pennywise_session` (`HttpOnly`)
- Header `Authorization: Bearer <same token>`

There is no request header that selects a user id.

Sign-in is a browser navigation, not a JSON call:

1. `GET /auth/google/login` redirects to Google and sets an `oauth_state` cookie.
2. `GET /auth/google/callback` checks that state, creates or updates the user, sets `pennywise_session` for 30 days, and redirects to `FRONTEND_URL` or `/`.
3. `POST /auth/logout` clears `pennywise_session` and returns `204`.

A new Google account is `pending` until an admin approves it. The only admin is the verified Google account whose email equals `ADMIN_EMAIL`. A stored role in the database does not grant admin to any other email.

`GET /api/v1/me` works for a pending user. Every other `/api/v1` route requires an `active` user linked to a household.

## Household selection

Send `X-Household-ID: <id>` to choose a household the signed-in user can access. When the header is missing, the API uses the user's `household_id`.

## Errors

Failed responses are JSON:

```json
{ "error": "authentication required" }
```

| Status | When |
| --- | --- |
| 400 | The body or query is invalid |
| 401 | The session is missing or invalid |
| 403 | The account is pending, or the household is not allowed |
| 404 | The expense does not exist in the selected household, or the route does not exist |
| 204 | Logout, delete expense, and delete budget succeed with an empty body |

## User

```json
{
  "id": 1,
  "household_id": 1,
  "google_id": "google-subject",
  "email": "person@example.com",
  "name": "Person",
  "picture_url": "https://example.com/photo",
  "role": "user",
  "status": "active",
  "households": [
    { "id": 1, "name": "Kamath Family", "base_currency_code": "INR" }
  ]
}
```

`role` is `admin` or `user`. `status` is `pending` or `active`.

### `GET /api/v1/me`

Returns the signed-in user.

## Expenses

```json
{
  "id": 10,
  "household_id": 1,
  "original_amount_minor": 25000,
  "original_currency_code": "INR",
  "converted_amount_minor": 25000,
  "converted_currency_code": "INR",
  "exchange_rate": "1.0000000000",
  "category_id": 1,
  "payment_source_id": 1,
  "merchant": "Store",
  "notes": "",
  "expense_date": "2026-09-01T00:00:00Z",
  "created_by": 2,
  "metadata_json": "",
  "tags": ["groceries"],
  "created_at": "2026-09-01T12:00:00Z",
  "updated_at": "2026-09-01T12:00:00Z"
}
```

### `GET /api/v1/expenses`

Returns an array of expenses for the selected household, newest first.

| Query | Meaning |
| --- | --- |
| `date_from` | Inclusive start, `YYYY-MM-DD` or RFC3339 |
| `date_to` | Inclusive end date. The filter uses the following day as an exclusive bound |
| `category_id` | Category id |
| `payment_source_id` | Payment source id |
| `search` or `q` | Case-insensitive match on merchant, notes, tags, category, payment source, currency, and amount |
| `tags` or `tag` | Comma-separated tag names. Every tag must match |
| `limit` | Page size. `0` and values above `200` are treated as `50` |
| `offset` | Number of rows to skip |

### `POST /api/v1/expenses`

Creates an expense. Returns `201` and the expense.

```json
{
  "original_amount_minor": 25000,
  "original_currency_code": "INR",
  "category_id": 1,
  "payment_source_id": 1,
  "merchant": "Store",
  "notes": "",
  "expense_date": "2026-09-01",
  "metadata_json": "",
  "tags": ["groceries"]
}
```

`original_amount_minor` must be greater than zero. `expense_date` may be omitted and then defaults to the current time.

### `GET /api/v1/expenses/:id`

Returns one expense in the selected household, or `404`.

### `PATCH /api/v1/expenses/:id`

Updates the expense. Send only the fields to change. `tags` replaces the full set when present. Returns the expense.

### `DELETE /api/v1/expenses/:id`

Soft-deletes the expense. Returns `204`.

### `GET /api/v1/tags`

Returns up to 30 tags for the selected household.

| Query | Meaning |
| --- | --- |
| `search` or `q` | Case-insensitive name filter |

```json
[{ "id": 1, "household_id": 1, "name": "groceries" }]
```

## Categories

```json
{ "id": 1, "name": "Food", "emoji": "🍽️" }
```

### `GET /api/v1/categories`

Returns every category. Categories are shared across households.

### `POST /api/v1/categories`

Creates a category. Returns `201`.

```json
{ "name": "School", "emoji": "📚" }
```

`name` is required. An empty `emoji` is stored as `📦`.

## Payment sources

```json
{ "id": 1, "name": "Cash", "type": "cash", "currency_code": "INR" }
```

`type` is one of `bank_account`, `credit_card`, `upi`, `cash`, `other`.

Payment sources are shared across households.

### `GET /api/v1/payment-sources`

Returns every payment source.

### `POST /api/v1/payment-sources`

Creates a payment source. Returns `201`.

```json
{ "name": "Card", "type": "credit_card", "currency_code": "INR" }
```

## Dashboard

### `GET /api/v1/dashboard?month=YYYY-MM`

`month` defaults to the current month.

```json
{
  "month_total": 25000,
  "by_category": [
    { "id": 1, "name": "Food", "amount_minor": 25000, "transaction_count": 1, "currency_code": "INR" }
  ],
  "by_payment_source": [
    { "id": 1, "name": "Cash", "amount_minor": 25000, "transaction_count": 1, "currency_code": "INR" }
  ]
}
```

## Budgets

```json
{
  "id": 1,
  "household_id": 1,
  "category_id": 1,
  "month": "2026-09",
  "amount_minor": 500000,
  "currency_code": "INR",
  "spent_minor": 25000,
  "created_at": "2026-09-01T12:00:00Z",
  "updated_at": "2026-09-01T12:00:00Z"
}
```

`spent_minor` is present on list responses. `month` is `YYYY-MM`.

### `GET /api/v1/budgets?month=YYYY-MM`

Returns budgets for the selected household and month, including `spent_minor`.

### `PUT /api/v1/budgets`

Creates or replaces the budget for that household, category, and month.

```json
{
  "category_id": 1,
  "month": "2026-09",
  "amount_minor": 500000,
  "currency_code": "INR"
}
```

`amount_minor` must be greater than zero. `currency_code` must be three letters.

### `DELETE /api/v1/budgets/:id`

Deletes the budget in the selected household. Returns `204`.

## Admin

These routes require an active admin. The admin is the `ADMIN_EMAIL` account only.

### `GET /api/v1/admin/users`

Returns users whose `household_id` is the admin's current household. Each item is a user object.

### `PATCH /api/v1/admin/users/:id`

Approves or returns a non-admin user to pending.

```json
{ "role": "user", "status": "active" }
```

`role` must be `user`. The admin account cannot be changed. Returns the user.

### `PATCH /api/v1/admin/users/:id/households`

Replaces the user's household access. At least one id is required. The first id becomes `household_id`.

```json
{ "household_ids": [1, 2] }
```

Returns the user.

### `GET /api/v1/admin/households`

Returns every household.

```json
[{ "id": 1, "name": "Kamath Family", "base_currency_code": "INR" }]
```

### `POST /api/v1/admin/households`

Creates a household and adds it to the admin's access. Returns `201`.

```json
{ "name": "Parents", "base_currency_code": "INR" }
```

`name` is required. `base_currency_code` must be three letters.

## Health

### `GET /healthz`

Does not require a session.

```json
{ "status": "ok" }
```
