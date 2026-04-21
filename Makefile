.PHONY: dev backend frontend migrate db-up db-down install build

dev:
	python pnd.py dev

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

migrate:
	cd backend && go run ./cmd/migrate up

backend:
	cd backend && go run .

frontend:
	cd frontend && npm run dev

install:
	cd frontend && npm install

build:
	cd backend && go build -o bin/server .
	cd frontend && npm run build
