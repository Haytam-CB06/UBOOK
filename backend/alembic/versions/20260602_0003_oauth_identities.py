"""oauth identities"""
from __future__ import annotations

from alembic import op

from app.models import Base

revision = "20260602_0003"
down_revision = "20260601_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    # Forward-only to avoid dropping linked social identities from production data.
    pass
