# Pennywise

Pennywise is a self-hosted family expense tracker for recording shared spending,
managing budgets, and reviewing monthly progress.

## Features

- Google sign-in with household-based access
- Expense tracking with categories, tags, payment sources, and currencies
- Dashboard, reports, month review, savings, and category budgets
- Admin approval for household access
- Mobile-friendly web app that can be added to an iPhone home screen

## Screenshots

Add a current app screenshot at `docs/screenshots/dashboard.png` after running
the app with real data.

<!-- Uncomment after adding the screenshot.
![Pennywise dashboard](docs/screenshots/dashboard.png)
-->

## Run locally

Start the backend:

```sh
cd backend
cp .env.example .env
docker compose up --build
```

In another terminal, start the frontend:

```sh
cd frontend
npm install
npm run dev
```

The frontend is available at `http://localhost:5173` and proxies API requests
to the backend at `http://localhost:8080`.

## Deployment

Build and deploy the frontend and Go server with:

```sh
./deploy.sh
```

See [backend/README.md](backend/README.md) and
[frontend/README.md](frontend/README.md) for environment and hosting details.
