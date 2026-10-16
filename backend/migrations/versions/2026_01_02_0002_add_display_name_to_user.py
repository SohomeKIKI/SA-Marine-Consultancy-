"""add display_name to users and actor_name to audit_logs

Revision ID: 0002_add_display_name_to_user
Revises: 0001_audit_log_permissions
Create Date: 2026-01-02 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0002_add_display_name_to_user'
down_revision: Union[str, None] = '0001_audit_log_permissions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('display_name', sa.String(length=100), nullable=True))
    op.add_column('audit_logs', sa.Column('actor_name', sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column('audit_logs', 'actor_name')
    op.drop_column('users', 'display_name')
