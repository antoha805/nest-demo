# nest-demo

Demo REST API built with NestJS, TypeORM and PostgreSQL.

Requires Node.js 20.19+ and Docker.

## Getting started

```bash
cp .env.example .env
npm install
docker compose up -d --wait
npm run seed
npm run start:dev
```

The API is served at `http://localhost:3000/api`. Postgres is exposed on host port `5433`.

The schema is created automatically by TypeORM `synchronize`, which is suitable for a demo only. Use migrations for production.

## Configuration

Settings are read from environment variables and `.env`; see `.env.example`. Real environment variables take precedence over `.env`.

| Variable      | Required | Description               |
| ------------- | -------- | ------------------------- |
| `PORT`        | No       | API port (default `3000`) |
| `DB_HOST`     | Yes      | Postgres host             |
| `DB_PORT`     | Yes      | Postgres port             |
| `DB_USERNAME` | Yes      | Postgres user             |
| `DB_PASSWORD` | Yes      | Postgres password         |
| `DB_NAME`     | Yes      | Postgres database         |

They are validated at startup, and the app exits with an error listing any missing or invalid values.

## Endpoints

| Method | Path                  | Description       |
| ------ | --------------------- | ----------------- |
| POST   | `/api/categories`     | Create a category |
| GET    | `/api/categories`     | List categories   |
| GET    | `/api/categories/:id` | Get a category    |
| PATCH  | `/api/categories/:id` | Update a category |
| DELETE | `/api/categories/:id` | Delete a category |
| POST   | `/api/posts`          | Create a post     |
| GET    | `/api/posts`          | List posts        |
| GET    | `/api/posts/:id`      | Get a post        |
| PATCH  | `/api/posts/:id`      | Update a post     |
| DELETE | `/api/posts/:id`      | Delete a post     |

A category that still has posts cannot be deleted (`409 Conflict`).

## Seeding

`npm run seed` adds sample categories and posts. It can be run repeatedly: existing categories are updated, existing posts are left unchanged, and nothing is deleted.

## Tests

`npm run test:e2e` runs the API tests. Postgres must be running. Tests clean up the records they create.
