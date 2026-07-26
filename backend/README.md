# Pennywise Backend

Self-hosted family expense tracking backend built from `Design.md`.

## Run locally

```sh
cp .env.example .env
docker compose up --build
```

The API listens on `http://localhost:8080`.

Authenticated routes use the `pennywise_session` cookie set by Google OAuth.
During local API testing, authenticated routes also accept `X-User-ID`.
Set `DEV_AUTH_USER_ID` only when you intentionally want every request without
a session to use a development user.

Google OAuth should redirect to the backend callback:
`http://localhost:8080/auth/google/callback`. After the backend sets the
session cookie, it redirects the browser to `/`. Set `FRONTEND_URL` only when
the frontend is hosted on a different origin.

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
sign-ins are created as pending users. An active admin can approve users and
change roles from the frontend Admin panel.
`ADMIN_EMAIL` is required at startup; when that Google account signs in, it is
automatically marked as an active admin.

## Migrations

Migrations live in `migrations/` and are mounted into the migrate service:

```sh
docker compose run --rm migrate
```
