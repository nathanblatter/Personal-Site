"""Pytest bootstrap.

The async engine is created at import time from DATABASE_URL. Point it at a dummy
Postgres URL so engine construction succeeds without touching a real database —
the units under test are pure functions that never open a connection.
"""
import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
