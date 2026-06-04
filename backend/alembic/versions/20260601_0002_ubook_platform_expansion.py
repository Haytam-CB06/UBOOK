"""ubook platform expansion

Revision ID: 20260601_0002
Revises: 20260531_0001
Create Date: 2026-06-01
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

from app.models import Base, BookingStatus, PropertyKind, VerificationStatus

revision = "20260601_0002"
down_revision = "20260531_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for value in ("villa", "resort", "cabin"):
            op.execute(f"ALTER TYPE propertykind ADD VALUE IF NOT EXISTS '{value}'")
        for value in ("draft", "rejected", "refunded"):
            op.execute(f"ALTER TYPE bookingstatus ADD VALUE IF NOT EXISTS '{value}'")

    Base.metadata.create_all(bind=bind)
    inspector = inspect(bind)

    add_column_if_missing(inspector, "users", sa.Column("phone", sa.String(length=40), nullable=True, index=True))
    add_column_if_missing(inspector, "users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    add_column_if_missing(inspector, "users", sa.Column("phone_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    add_column_if_missing(inspector, "users", sa.Column("identity_verified", sa.Boolean(), nullable=False, server_default=sa.false()))
    add_column_if_missing(inspector, "users", sa.Column("suspended_at", sa.DateTime(timezone=True), nullable=True))
    add_column_if_missing(inspector, "users", sa.Column("banned_at", sa.DateTime(timezone=True), nullable=True))
    add_column_if_missing(inspector, "users", sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))

    add_column_if_missing(inspector, "properties", sa.Column("title", sa.String(length=180), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("property_type", sa.String(length=60), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("address", sa.String(length=255), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("price_per_night", sa.Numeric(10, 2), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("cleaning_fee", sa.Numeric(10, 2), nullable=False, server_default="0"))
    add_column_if_missing(inspector, "properties", sa.Column("service_fee", sa.Numeric(10, 2), nullable=False, server_default="0"))
    add_column_if_missing(inspector, "properties", sa.Column("average_rating", sa.Float(), nullable=False, server_default="0"))
    add_column_if_missing(inspector, "properties", sa.Column("max_guests", sa.Integer(), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("bedrooms", sa.Integer(), nullable=False, server_default="1"))
    add_column_if_missing(inspector, "properties", sa.Column("bathrooms", sa.Float(), nullable=False, server_default="1"))
    add_column_if_missing(inspector, "properties", sa.Column("beds", sa.Integer(), nullable=False, server_default="1"))
    add_column_if_missing(inspector, "properties", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))
    add_column_if_missing(inspector, "properties", sa.Column("available_from", sa.Date(), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("published_at", sa.DateTime(timezone=True), nullable=True))
    add_column_if_missing(inspector, "properties", sa.Column("draft_data", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))

    add_column_if_missing(inspector, "reviews", sa.Column("avatar_url", sa.String(length=500), nullable=False, server_default=""))


def downgrade() -> None:
    # This expansion is intentionally forward-only for production data safety.
    pass


def add_column_if_missing(inspector, table_name: str, column: sa.Column) -> None:
    columns = {item["name"] for item in inspector.get_columns(table_name)} if inspector.has_table(table_name) else set()
    if column.name not in columns:
        op.add_column(table_name, column)
