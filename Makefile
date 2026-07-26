SHELL := /bin/sh

FRONTEND_DIR := frontend
BACKEND_DIR := backend

NPM ?= npm
GO ?= go
GOFMT ?= gofmt
DOCKER_COMPOSE ?= docker compose
MIGRATE_DATABASE_URL ?= mysql://root:admin123@tcp(127.0.0.1:3306)/pennywise?parseTime=true&multiStatements=true

.DEFAULT_GOAL := help

.PHONY: help install install-frontend install-backend run dev frontend backend \
	db-up db-down migrate migrate-docker build build-frontend build-backend lint test clean

help:
	@printf "%s\n" "Pennywise root commands"
	@printf "%s\n" ""
	@printf "%s\n" "  make install           Install frontend and backend dependencies"
	@printf "%s\n" "  make run               Run migrations, then frontend and backend"
	@printf "%s\n" "  make frontend          Run only the frontend dev server"
	@printf "%s\n" "  make backend           Run only the backend server"
	@printf "%s\n" "  make db-up             Start backend MySQL via Docker Compose"
	@printf "%s\n" "  make db-down           Stop backend Docker Compose services"
	@printf "%s\n" "  make migrate           Run backend database migrations locally"
	@printf "%s\n" "  make migrate-docker    Run backend database migrations with Docker"
	@printf "%s\n" "  make build             Build frontend and backend"
	@printf "%s\n" "  make lint              Lint frontend and format-check backend"
	@printf "%s\n" "  make test              Run backend tests"
	@printf "%s\n" "  make clean             Remove frontend build artifacts"

install: install-frontend install-backend

install-frontend:
	cd $(FRONTEND_DIR) && $(NPM) install

install-backend:
	cd $(BACKEND_DIR) && $(GO) mod download

run: migrate dev

dev:
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) backend & \
	$(MAKE) frontend & \
	wait

frontend:
	cd $(FRONTEND_DIR) && $(NPM) run dev

backend:
	cd $(BACKEND_DIR) && $(GO) run ./cmd/server

db-up:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) up -d mysql

db-down:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) down

migrate:
	cd $(BACKEND_DIR) && $(GO) run -tags mysql github.com/golang-migrate/migrate/v4/cmd/migrate@v4.18.3 -path migrations -database '$(MIGRATE_DATABASE_URL)' up

migrate-docker:
	cd $(BACKEND_DIR) && $(DOCKER_COMPOSE) run --rm migrate

build: build-frontend build-backend

build-frontend:
	cd $(FRONTEND_DIR) && $(NPM) run build

build-backend:
	cd $(BACKEND_DIR) && $(GO) build -o bin/pennywise ./cmd/server

lint:
	cd $(FRONTEND_DIR) && $(NPM) run lint
	cd $(BACKEND_DIR) && test -z "$$($(GOFMT) -l cmd internal)"

test:
	cd $(BACKEND_DIR) && $(GO) test ./...

clean:
	rm -rf $(FRONTEND_DIR)/dist $(BACKEND_DIR)/bin
