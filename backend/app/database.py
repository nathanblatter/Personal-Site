import os
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://portfolio:portfolio@db:5432/portfolio",
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=5,
    pool_pre_ping=True,
    pool_recycle=3600,
)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
