from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.config import settings
from app.core.db import get_db
from app.iam.routes import router as iam_router
from app.audit.routes import router as audit_router
from app.batches.routes import router as batches_router
from app.students.routes import router as students_router
from app.payments.routes import router as payments_router
from app.notifications.routes import router as notifications_router
from app.admin.routes import router as admin_router
from app.profile.routes import router as profile_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
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
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
