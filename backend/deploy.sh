#!/bin/sh
set -e

cd "$(dirname "$0")"

echo "==> Building API image..."
DOCKER_BUILDKIT=0 docker build --pull=false -t backend-api:latest .

echo "==> Building journal worker image..."
# Build context is the repo root so backend/ + frontend/ are visible (matches CI).
DOCKER_BUILDKIT=0 docker build --pull=false -f Dockerfile.worker -t backend-worker:latest ..

echo "==> Starting services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --force-recreate

echo "==> Waiting for API to be healthy..."
sleep 8

echo "==> Seeding database (skips if already seeded)..."
docker compose -f docker-compose.prod.yml exec api python seed.py

echo "==> Done. Status:"
docker compose -f docker-compose.prod.yml ps
