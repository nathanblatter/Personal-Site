# nathanblatter.com — Portfolio Site

React + TypeScript + Tailwind CSS frontend served by a FastAPI + PostgreSQL backend.

---

## Stack

| Layer      | Tech                                          |
|------------|-----------------------------------------------|
| Frontend   | React 19, TypeScript, Tailwind CSS v4, Vite   |
| Backend    | FastAPI, SQLAlchemy (async), asyncpg          |
| Database   | PostgreSQL 16                                 |
| Migrations | Alembic                                       |
| Container  | Docker + Docker Compose                       |
| Hosting    | Mac Mini → Cloudflare Tunnel → FastAPI container |

In production, a single FastAPI container serves both `/api/v1/*` endpoints and the compiled React build.

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Compose)
- Node.js ≥ 18 + npm

---

## Project layout

```
Personal-Site/
├── frontend/               # React application
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── components/
│   │   └── pages/
│   ├── public/             # Static assets (headshot, favicon, etc.)
│   ├── dist/               # Vite build output (gitignored)
│   ├── index.html
│   ├── vite.config.ts      # Proxies /api → localhost:8000 in dev
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── tsconfig.node.json
│   ├── eslint.config.js
│   └── package.json
├── backend/                # FastAPI application
│   ├── app/
│   │   ├── main.py         # FastAPI app, CORS, SPA catch-all
│   │   ├── database.py     # Async engine + session
│   │   ├── models.py       # SQLAlchemy ORM models
│   │   ├── schemas.py      # Pydantic schemas
│   │   └── routers/
│   │       ├── projects.py
│   │       ├── skills.py
│   │       ├── experience.py
│   │       ├── about.py    # about singleton + interests + coursework
│   │       └── contact.py  # contact meta singleton + socials
│   ├── alembic/
│   │   └── versions/001_initial.py
│   ├── alembic.ini
│   ├── seed.py             # Populates DB from frontend hardcoded data
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── startup.sh          # runs: alembic upgrade head && uvicorn
│   └── requirements.txt
└── README.md
```

---

## Local development

There are two modes. **Split mode** is recommended for active development.

### Mode 1 — Split (backend in Docker, frontend on Vite)

The fastest workflow. Backend runs in Docker; frontend has hot reload via the Vite dev server. `vite.config.ts` is already configured to proxy `/api/*` to `localhost:8000`.

**1. Start the backend**

```bash
cd backend
docker compose up --build -d
```

This starts:
- `db` — PostgreSQL on **localhost:5433**
- `api` — FastAPI on **localhost:8000** (runs `alembic upgrade head` automatically on startup)

Check it's healthy:

```bash
docker compose ps
# Both services should show "healthy" / "running"

curl http://localhost:8000/api/v1/projects
# Returns [] (empty array before seeding)
```

**2. Seed the database**

```bash
docker compose exec api python seed.py
```

Expected output:
```
Seeding projects...
Seeding skills...
Seeding experience...
Seeding about...
Seeding interests...
Seeding coursework...
Seeding socials...
Seeding contact meta...
Database seeded successfully!
```

**3. Start the frontend**

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite proxy routes `/api/*` calls to the FastAPI backend.

---

### Mode 2 — Full Docker (mirrors production)

Builds the React app and serves everything through FastAPI, exactly like production.

```bash
# 1. Build the frontend
cd frontend
npm run build               # outputs to frontend/dist/

# 2. Start the stack (frontend/dist/ is bind-mounted into the container)
cd ../backend
docker compose up --build -d

# 3. Seed
docker compose exec api python seed.py
```

Open [http://localhost:8000](http://localhost:8000).

---

## Verifying the API

Interactive docs are always available once the backend is running:

- **Swagger UI** → [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **ReDoc** → [http://localhost:8000/api/redoc](http://localhost:8000/api/redoc)

### Smoke test — all endpoints

```bash
curl -s http://localhost:8000/api/v1/projects         | python3 -m json.tool
curl -s http://localhost:8000/api/v1/skills           | python3 -m json.tool
curl -s http://localhost:8000/api/v1/experience       | python3 -m json.tool
curl -s http://localhost:8000/api/v1/about            | python3 -m json.tool
curl -s http://localhost:8000/api/v1/about/interests  | python3 -m json.tool
curl -s http://localhost:8000/api/v1/about/coursework | python3 -m json.tool
curl -s http://localhost:8000/api/v1/contact          | python3 -m json.tool
curl -s http://localhost:8000/api/v1/contact/socials  | python3 -m json.tool
```

### Create / update / delete example

```bash
# Create a skill
curl -X POST http://localhost:8000/api/v1/skills \
  -H "Content-Type: application/json" \
  -d '{"name":"Docker","level":75,"category":"Cloud","sort_order":10}'

# Update it (use the id returned above)
curl -X PUT http://localhost:8000/api/v1/skills/11 \
  -H "Content-Type: application/json" \
  -d '{"level":80}'

# Delete it
curl -X DELETE http://localhost:8000/api/v1/skills/11
```

---

## API reference

All routes are prefixed with `/api/v1/`.

### Full CRUD resources

| Resource   | Base path               | List     | Get one      | Create   | Update       | Delete         |
|------------|-------------------------|----------|--------------|----------|--------------|----------------|
| Projects   | `/projects`             | GET `/`  | GET `/{id}`  | POST `/` | PUT `/{id}`  | DELETE `/{id}` |
| Skills     | `/skills`               | GET `/`  | GET `/{id}`  | POST `/` | PUT `/{id}`  | DELETE `/{id}` |
| Experience | `/experience`           | GET `/`  | GET `/{id}`  | POST `/` | PUT `/{id}`  | DELETE `/{id}` |
| Interests  | `/about/interests`      | GET `/`  | GET `/{id}`  | POST `/` | PUT `/{id}`  | DELETE `/{id}` |
| Coursework | `/about/coursework`     | GET `/`  | GET `/{id}`  | POST `/` | PUT `/{id}`  | DELETE `/{id}` |
| Socials    | `/contact/socials`      | GET `/`  | GET `/{id}`  | POST `/` | PUT `/{id}`  | DELETE `/{id}` |

All list endpoints return results ordered by `sort_order`.

PUT requests are **partial** — only the fields you send are changed.

### Singleton resources (GET + PUT only)

| Resource      | Route      | Notes                   |
|---------------|------------|-------------------------|
| About content | `/about`   | Always `id=1`, upserted |
| Contact meta  | `/contact` | Always `id=1`, upserted |

---

## Data models

### Project
```json
{
  "id": 1,
  "project_id": "ai-web-app",
  "title": "Full-Stack AI Web Application",
  "description": "...",
  "tags": ["React", "WebRTC", "AWS EC2"],
  "year": "2025–2026",
  "color": "#3b6cf5",
  "status": "live",
  "link": "https://...",
  "sort_order": 0
}
```
`status` must be one of `live | wip | archived`.

### Skill
```json
{ "id": 1, "name": "Python", "level": 85, "category": "Lang", "sort_order": 1 }
```

### Experience
```json
{
  "id": 1,
  "year": "March 2026 — Present",
  "title": "Full Stack Software Engineer",
  "subtitle": "BYU Production Services",
  "description": "...",
  "active": true,
  "sort_order": 0
}
```

### About (singleton)
```json
{
  "id": 1,
  "bio_paragraphs": ["Paragraph one...", "Paragraph two..."],
  "facts": [{ "icon": "BookOpen", "text": "IS Major — BYU" }],
  "headshot_url": "/headshot.jpg",
  "status_text": "Open to opportunities",
  "info_fields": [{ "label": "GPA", "value": "3.64" }]
}
```

### Interest
```json
{ "id": 1, "icon": "Brain", "label": "AI & Machine Learning", "desc": "Voice-enabled AI, vector embeddings, NLP", "sort_order": 0 }
```

### Coursework
```json
{ "id": 1, "name": "Database Systems", "sort_order": 0 }
```

### Social
```json
{ "id": 1, "icon": "Github", "label": "GitHub", "handle": "@nathanblatter", "href": "https://github.com/nathanblatter", "sort_order": 0 }
```

### Contact Meta (singleton)
```json
{
  "id": 1,
  "heading": "Get in Touch",
  "subheading": "Have a project idea, opportunity, or just want to say hi?",
  "body_text": "...",
  "location_text": "Provo UT, San Francisco CA — Available for remote & local"
}
```

---

## Environment variables

| Variable       | Default                                                      | Description                     |
|----------------|--------------------------------------------------------------|---------------------------------|
| `DATABASE_URL` | `postgresql+asyncpg://portfolio:portfolio@db:5432/portfolio` | Async SQLAlchemy connection URL |
| `STATIC_DIR`   | `frontend/dist` (relative to repo root)                      | Path to the Vite build output   |

---

## Database

PostgreSQL runs inside Docker. To connect directly:

```bash
# psql from inside the container
docker compose -f backend/docker-compose.yml exec db psql -U portfolio -d portfolio

# psql from the host (port 5433 to avoid conflicts with any local postgres)
psql -h localhost -p 5433 -U portfolio -d portfolio
```

### Migrations

```bash
cd backend

# Apply all pending migrations (also runs automatically on container startup)
docker compose exec api alembic upgrade head

# Roll back one revision
docker compose exec api alembic downgrade -1

# Auto-generate a new migration after changing models.py
docker compose exec api alembic revision --autogenerate -m "describe your change"
```

### Re-seeding from scratch

The seed script is a no-op if any projects already exist. To fully reset:

```bash
cd backend
docker compose down -v          # destroys the pgdata volume
docker compose up -d            # recreates and runs migrations
docker compose exec api python seed.py
```

---

## Common Docker commands

```bash
# Run from backend/ or use -f flag from repo root

# Start (detached)
docker compose up -d

# Start and rebuild image
docker compose up --build -d

# Stop (keeps data volume)
docker compose down

# Stop and wipe the database
docker compose down -v

# Tail API logs
docker compose logs -f api

# Open a shell in the API container
docker compose exec api bash
```

---

## Production deployment (Mac Mini)

Production uses `docker-compose.prod.yml`, which skips the `db` container and points directly at the PostgreSQL instance running on the Mac Mini host.

```bash
# 1. Pull latest code
git pull

# 2. Build the frontend
cd frontend
npm run build               # outputs to frontend/dist/

# 3. Rebuild and restart using the prod compose file
cd ../backend
docker compose -f docker-compose.prod.yml up --build -d
```

On first deploy, run migrations and seed:
```bash
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml exec api python seed.py
```

Cloudflare Tunnel forwards `nathanblatter.com` traffic to `localhost:8000`. FastAPI handles:
- `/api/v1/*` → API endpoints
- `/*` → React SPA (serves `frontend/dist/index.html` for any unmatched path)

> `frontend/dist/` is bind-mounted into the container read-only. Frontend-only changes only require `npm run build` — no Docker rebuild needed.

### Dev vs prod at a glance

| | Dev (`docker-compose.yml`) | Prod (`docker-compose.prod.yml`) |
|---|---|---|
| Database | Postgres container (`db`) | Host Postgres via `host.docker.internal:5432` |
| DB credentials | `portfolio / portfolio` | `postgres / postgres` |
| DB name | `portfolio` | `portfolio` |

---

## Troubleshooting

**`seed.py` says "Data already seeded. Skipping."**
Expected if you've seeded before. To reseed: `docker compose down -v && docker compose up -d && docker compose exec api python seed.py`

**`alembic upgrade head` fails with "relation already exists"**
The tables were probably created by `seed.py` before Alembic ran. Stamp the current state to fix:
```bash
docker compose exec api alembic stamp head
```

**Port conflict on 5433**
The `db` service binds to host port `5433` (not `5432`) to avoid clashing with any locally installed PostgreSQL. If something else occupies `5433`, edit `backend/docker-compose.yml` and change `"5433:5432"` to a free port.

**API returns 404 on `/api/v1/about` after seeding**
The about singleton is inserted by `seed.py`. If you skipped seeding, create it manually:
```bash
curl -X PUT http://localhost:8000/api/v1/about \
  -H "Content-Type: application/json" \
  -d '{"bio_paragraphs":[],"facts":[],"info_fields":[]}'
```
