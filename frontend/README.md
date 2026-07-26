# Pennywise Frontend

React PWA for the Pennywise backend.

## Run

```sh
npm install
npm run dev
```

The Vite dev server proxies `/api`, `/auth`, and `/healthz` to `http://localhost:8080`.

Set `VITE_API_BASE_URL` when serving the frontend separately from the backend proxy.

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

Register the same `GOOGLE_REDIRECT_URL` in Google Cloud Console.
