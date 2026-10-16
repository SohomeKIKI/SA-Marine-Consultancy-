import logging
from sqlalchemy import select
from app.core.config import settings
from app.core.db import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.iam.models import User, UserRole

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_admin_user():
    # Ensure tables exist
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        admin_email = settings.FIRST_ADMIN_EMAIL.lower().strip()
        existing = db.execute(select(User).where(User.email == admin_email)).scalars().first()
        if existing:
            logger.info("Admin user (%s) already exists. Skipping seed.", admin_email)
            return

        admin_user = User(
            name=settings.FIRST_ADMIN_NAME.strip(),
            email=admin_email,
            password_hash=get_password_hash(settings.FIRST_ADMIN_PASSWORD),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin_user)
        db.commit()
        logger.info("Default admin user created successfully: %s", admin_email)
    except Exception as e:
        logger.error("Error creating initial admin: %s", e)
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_admin_user()
