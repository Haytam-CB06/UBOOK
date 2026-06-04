"""production operations tables"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

from app.models import Base

revision = "20260602_0004"
down_revision = "20260602_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)
    inspector = inspect(bind)
    add_column_if_missing(inspector, "availability_calendars", sa.Column("price_override", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    # Forward-only to protect production operational data.
    pass


def add_column_if_missing(inspector, table_name: str, column: sa.Column) -> None:
    columns = {item["name"] for item in inspector.get_columns(table_name)} if inspector.has_table(table_name) else set()
    if column.name not in columns:
        op.add_column(table_name, column)
