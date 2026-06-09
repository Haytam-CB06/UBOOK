"""add_traveler_schema

Revision ID: 23a1b3857f79
Revises: 20260602_0004
Create Date: 2026-06-06 20:10:30.266450
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect
import sqlalchemy_utils

revision = "23a1b3857f79"
down_revision = "20260602_0004"
branch_labels = None
depends_on = None


def has_table(inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def has_column(inspector, table_name: str, column_name: str) -> bool:
    if not has_table(inspector, table_name):
        return False
    return column_name in [c["name"] for c in inspector.get_columns(table_name)]


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)

    if not has_table(inspector, "travelers"):
        op.create_table(
            "travelers",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("booking_id", sa.Integer(), nullable=False),
            sa.Column("full_name", sa.String(length=160), nullable=False),
            sa.Column("nationality", sa.String(length=100), nullable=False),
            sa.Column("birth_date", sa.Date(), nullable=False),
            sa.Column(
                "passport_number",
                sqlalchemy_utils.types.encrypted.encrypted_type.EncryptedType(),
                nullable=False,
            ),
            sa.Column("gender", sa.String(length=20), nullable=True),
            sa.Column("relationship_to_primary_guest", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["booking_id"], ["bookings.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_travelers_booking_id", "travelers", ["booking_id"], unique=False)
        op.create_index("ix_travelers_deleted_at", "travelers", ["deleted_at"], unique=False)

    if not has_column(inspector, "bookings", "traveler_count"):
        op.add_column("bookings", sa.Column("traveler_count", sa.Integer(), nullable=False, server_default="1"))
        op.alter_column("bookings", "traveler_count", server_default=None)

    if not has_column(inspector, "bookings", "special_requests"):
        op.add_column("bookings", sa.Column("special_requests", sa.Text(), nullable=True))

    if not has_column(inspector, "bookings", "arrival_time"):
        op.add_column("bookings", sa.Column("arrival_time", sa.String(length=20), nullable=True))

    if has_column(inspector, "bookings", "notes"):
        op.drop_column("bookings", "notes")

    if has_column(inspector, "bookings", "guests"):
        op.drop_column("bookings", "guests")

    if not has_column(inspector, "traveler_profiles", "nationality"):
        op.add_column("traveler_profiles", sa.Column("nationality", sa.String(length=100), nullable=True))

    if not has_column(inspector, "traveler_profiles", "birth_date"):
        op.add_column("traveler_profiles", sa.Column("birth_date", sa.Date(), nullable=True))

    if not has_column(inspector, "traveler_profiles", "identification_number"):
        op.add_column(
            "traveler_profiles",
            sa.Column(
                "identification_number",
                sqlalchemy_utils.types.encrypted.encrypted_type.EncryptedType(),
                nullable=True,
            ),
        )

    if not has_column(inspector, "traveler_profiles", "emergency_contact_name"):
        op.add_column("traveler_profiles", sa.Column("emergency_contact_name", sa.String(length=160), nullable=True))

    if not has_column(inspector, "traveler_profiles", "emergency_contact_phone"):
        op.add_column("traveler_profiles", sa.Column("emergency_contact_phone", sa.String(length=40), nullable=True))


def downgrade() -> None:
    pass