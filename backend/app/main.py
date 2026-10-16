from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI, Depends, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.core.db import get_db, engine, Base
from app.iam.routes import router as iam_router
from app.audit.routes import router as audit_router
from app.batches.routes import router as batches_router
from app.students.routes import router as students_router
from app.payments.routes import router as payments_router
from app.notifications.routes import router as notifications_router
from app.admin.routes import router as admin_router
from app.profile.routes import router as profile_router

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database tables exist and admin user is seeded on application startup
    try:
        import app.iam.models
        import app.audit.models
        import app.batches.models
        import app.students.models
        import app.payments.models
        import app.notifications.models
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created via metadata.")

        from app.iam.seed import seed_admin_user
        seed_admin_user()
        logger.info("Admin user verified/seeded.")
    except Exception as e:
        logger.error(f"Error during startup database initialization: {e}", exc_info=True)
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# Global Exception Handler to capture unhandled 500 errors in logs and JSON
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )

# Include Routers
app.include_router(iam_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(batches_router, prefix=settings.API_V1_STR)
app.include_router(students_router, prefix=settings.API_V1_STR)
app.include_router(payments_router, prefix=settings.API_V1_STR)
app.include_router(notifications_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix="/admin")
app.include_router(admin_router, prefix=f"{settings.API_V1_STR}/admin")
app.include_router(profile_router)
app.include_router(profile_router, prefix=settings.API_V1_STR)

# CORS Middleware
origins = list(settings.CORS_ORIGINS) if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"^https://.*\.vercel\.app$|^https://.*\.onrender\.com$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
def root_health():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": "1.0.0"}


@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
def api_health():
    return {"status": "ok", "app": settings.PROJECT_NAME, "version": "1.0.0"}


@app.get(f"{settings.API_V1_STR}/health/db", tags=["Health"])
def db_health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e)}
