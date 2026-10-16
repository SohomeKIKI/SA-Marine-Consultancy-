from typing import List, Literal, Union
import json
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SA Marine Consultancy"
    API_V1_STR: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite:///./batchcrm_dev.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_database_url(cls, v: str) -> str:
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return v.replace("postgres://", "postgresql+psycopg://", 1)
            elif v.startswith("postgresql://") and not v.startswith("postgresql+"):
                return v.replace("postgresql://", "postgresql+psycopg://", 1)
        return v

    # Security
    JWT_SECRET_KEY: str = "dev_super_secret_jwt_key_at_least_32_bytes_long_12345"
    REFRESH_SECRET_KEY: str = "dev_super_secret_refresh_key_at_least_32_bytes_67890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    SECURE_COOKIES: bool = False
    COOKIE_SAMESITE: Literal["lax", "none", "strict"] = "lax"

    # CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "https://sa-marine-consultancy.onrender.com",
        "https://sa-marine-consultancy.vercel.app",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        elif isinstance(v, str):
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return [str(item) for item in parsed]
            return [str(parsed)]
        raise ValueError(v)

    # Initial Admin Seed
    FIRST_ADMIN_NAME: str = "System Administrator"
    FIRST_ADMIN_EMAIL: str = "admin@batchcrm.com"
    FIRST_ADMIN_PASSWORD: str = "AdminPassword123!"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
