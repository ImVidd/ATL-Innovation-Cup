#!/usr/bin/env python3
"""
Initialize database tables in Supabase PostgreSQL.
Run this once after setting up Supabase project.
"""
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in .env")
    exit(1)

# Fix postgres:// to postgresql:// for SQLAlchemy 2.0
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

from sqlalchemy import create_engine, text

engine = create_engine(DATABASE_URL)

# Enable UUID extension (useful for future)
with engine.connect() as conn:
    conn.execute(text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'))
    conn.commit()

# Create tables using our models
from backend.app.models import Base
from backend.app.config import settings

# Override engine with correct URL
from backend.app.database import engine as app_engine
app_engine.dispose()

# Recreate with correct URL
import backend.app.database as db_module
db_module.engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
db_module.SessionLocal.configure(bind=db_module.engine)

from backend.app.database import init_db
init_db()

print("✅ Database tables created successfully!")
print("Tables:", Base.metadata.tables.keys())