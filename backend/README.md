# Pennywise Backend

Self-hosted family expense tracking backend built from `Design.md`.

The HTTP contract for every route is [docs/api.md](../docs/api.md).

## Run locally

```sh
cp .env.example .env
```

Set `JWT_SECRET` to a long random value before starting. The server refuses to
start when that value is empty or `change-me`.

```sh
docker compose up --build
```

The API listens on `http://localhost:8080`.

Authenticated routes require the `pennywise_session` cookie set by Google
OAuth, or an `Authorization: Bearer` token with the same value. There is no
development header that selects a user.

Google OAuth should redirect to the backend callback:
`http://localhost:8080/auth/google/callback`. After the backend sets the
session cookie, it redirects the browser to `/`. Set `FRONTEND_URL` when the
frontend is hosted on another origin. That origin is the only CORS allowlist
entry, and credentialed browser requests are allowed.

`COOKIE_SAMESITE` defaults to `lax`, which covers a frontend on the same site,
including localhost on another port. Set `COOKIE_SAMESITE=none` and
`COOKIE_SECURE=true` when the frontend is on a different site. `COOKIE_SECURE`
is forced on when `APP_ENV=production` or `FRONTEND_URL` uses `https`.

The backend can also serve the frontend PWA. Put the built frontend files in
`PUBLIC_DIR` beside the binary, for example:

```text
pennywise/
  migrations/
  pennywise
  public/
    index.html
    assets/
    manifest.webmanifest
    sw.js
```

Set `PUBLIC_DIR=public`; `/api/*` and `/auth/*` remain backend routes, while
all other paths serve the PWA with an `index.html` fallback.

Users have `admin` or `user` roles and `pending` or `active` status. New Google
sign-ins are created as pending users. The active admin can approve users from
the frontend Admin panel. `ADMIN_EMAIL` is required at startup. Only a verified
Google account with that email is an admin, and the admin role cannot be
granted to anyone else.

## Migrations

Migrations live in `migrations/` and are mounted into the migrate service:

```sh
docker compose run --rm migrate
```
