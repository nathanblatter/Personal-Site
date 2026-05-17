#!/usr/bin/env bash
# Creates the kpi database in the existing shared Postgres container.
# Run once before first deploy or let init_kpi_db() handle it automatically on startup.
#
# Usage: ./scripts/create_kpi_db.sh [container_name]
# Default container: docker-services-postgres-1

CONTAINER=${1:-docker-services-postgres-1}
docker exec -it "$CONTAINER" psql -U postgres -c "CREATE DATABASE kpi;"
