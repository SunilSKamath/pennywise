# Pennywise Frontend

React PWA for the Pennywise backend.

## Run

```sh
npm install
npm run dev
```

The Vite dev server proxies `/api`, `/auth`, and `/healthz` to `http://localhost:8080`.

Set `VITE_API_BASE_URL` to the API origin when serving the frontend separately
from that proxy. The request and response contract is
[docs/api.md](../docs/api.md). On the API, set `FRONTEND_URL` to this app's
origin so credentialed browser calls are allowed.

## PWA hosting

Serve the built `dist/` folder over HTTPS:

```sh
npm run build
```

The server must return `index.html` for client routes such as `/add`,
`/expenses`, `/settings`, and `/admin`. Keep these backend env values aligned
with the hosted frontend:

```env
FRONTEND_URL=https://app.example.com
GOOGLE_REDIRECT_URL=https://api.example.com/auth/google/callback
COOKIE_SECURE=true
```

`app.example.com` and `api.example.com` are the same site, so the default
`COOKIE_SAMESITE=lax` still sends the session cookie. Set `COOKIE_SAMESITE=none`
only when the frontend origin is a different site from the API.

Register the same `GOOGLE_REDIRECT_URL` in Google Cloud Console.
