from pydantic import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # App
    APP_NAME: str = "TA Grader"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Supabase
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_KEY: Optional[str] = None

    # Database (Supabase PostgreSQL)
    DATABASE_URL: str

    # Auth (Clerk or Supabase JWT)
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7  # 7 days

    # OpenAI
    OPENAI_API_KEY: str
    OPENAI_MODEL: str = "gpt-4o-mini"

    # File Storage
    STORAGE_BUCKET: str = "submissions"
    MAX_FILE_SIZE_MB: int = 50

    # OCR
    TESSERACT_CMD: Optional[str] = None  # Set if not in PATH

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()