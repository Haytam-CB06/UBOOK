from __future__ import annotations

import enum
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Table,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.mutable import MutableDict, MutableList
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.core.database import Base
from app.core.config import settings
from sqlalchemy_utils import EncryptedType
from sqlalchemy_utils.types.encrypted.encrypted_type import FernetEngine


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


JsonDictType = MutableDict.as_mutable(JSON().with_variant(JSONB, "postgresql"))
JsonListType = MutableList.as_mutable(JSON().with_variant(JSONB, "postgresql"))


class Role(str, enum.Enum):
    guest = "guest"
    hotel_admin = "hotel_admin"
    admin = "admin"
    super_admin = "super_admin"


class PropertyKind(str, enum.Enum):
    hotel = "hotel"
    apartment = "apartment"
    house = "house"
    riad = "riad"
    villa = "villa"
    resort = "resort"
    cabin = "cabin"


class BookingStatus(str, enum.Enum):
    draft = "draft"
    pending = "pending"
    confirmed = "confirmed"
    rejected = "rejected"
    checked_in = "checked_in"
    checked_out = "checked_out"
    cancelled = "cancelled"
    completed = "completed"
    refunded = "refunded"


class FavoriteType(str, enum.Enum):
    hotel = "hotel"
    apartment = "apartment"
    property = "property"


class PaymentProvider(str, enum.Enum):
    stripe = "stripe"
    paypal = "paypal"
    manual = "manual"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    requires_action = "requires_action"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"


class RefundStatus(str, enum.Enum):
    none = "none"
    requested = "requested"
    approved = "approved"
    rejected = "rejected"
    processed = "processed"


class VerificationStatus(str, enum.Enum):
    unverified = "unverified"
    pending = "pending"
    verified = "verified"
    rejected = "rejected"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, server_default=func.now(), nullable=False)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)


property_amenities = Table(
    "property_amenities",
    Base.metadata,
    Column("property_id", ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)


room_amenities = Table(
    "room_amenities",
    Base.metadata,
    Column("room_id", ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", ForeignKey("amenities.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), default=Role.guest, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(40), index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    identity_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    banned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    otp_secret: Mapped[str | None] = mapped_column(String(64))
    otp_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    otp_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    otp_recovery_codes: Mapped[list[str]] = mapped_column(JsonListType, default=list, nullable=False)

    sessions: Mapped[list[UserSession]] = relationship(back_populates="user", cascade="all, delete-orphan")
    oauth_accounts: Mapped[list[UserOAuthIdentity]] = relationship(back_populates="user", cascade="all, delete-orphan")
    traveler_profile: Mapped[TravelerProfile | None] = relationship(back_populates="user", cascade="all, delete-orphan")
    host_profile: Mapped[HostProfile | None] = relationship(back_populates="user", cascade="all, delete-orphan")
    bookings: Mapped[list[Booking]] = relationship(back_populates="user")
    reviews: Mapped[list[Review]] = relationship(back_populates="user")
    host_reviews_received: Mapped[list[HostReview]] = relationship(back_populates="host", foreign_keys="HostReview.host_id")
    traveler_reviews_received: Mapped[list[TravelerReview]] = relationship(back_populates="traveler", foreign_keys="TravelerReview.traveler_id")
    favorites: Mapped[list[Favorite]] = relationship(back_populates="user", cascade="all, delete-orphan")
    wishlists: Mapped[list[Wishlist]] = relationship(back_populates="user", cascade="all, delete-orphan")
    saved_searches: Mapped[list[SavedSearch]] = relationship(back_populates="user", cascade="all, delete-orphan")
    notification_preferences: Mapped[NotificationPreference | None] = relationship(back_populates="user", cascade="all, delete-orphan")
    account_preferences: Mapped[AccountPreference | None] = relationship(back_populates="user", cascade="all, delete-orphan")
    notifications: Mapped[list[Notification]] = relationship(back_populates="user", cascade="all, delete-orphan")
    payments: Mapped[list[Payment]] = relationship(back_populates="user")


class UserOAuthIdentity(Base, TimestampMixin):
    __tablename__ = "user_oauth_identities"
    __table_args__ = (
        UniqueConstraint("provider", "subject", name="uq_user_oauth_identities_provider_subject"),
        Index("ix_user_oauth_identities_user_provider", "user_id", "provider"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(160))
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    provider_data: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="oauth_accounts")


class TravelerProfile(Base, TimestampMixin):
    __tablename__ = "traveler_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_traveler_profiles_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    bio: Mapped[str | None] = mapped_column(Text)
    average_rating_received: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    review_count_received: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verification_status: Mapped[VerificationStatus] = mapped_column(Enum(VerificationStatus), default=VerificationStatus.unverified, nullable=False, index=True)

    nationality: Mapped[str | None] = mapped_column(String(100))
    birth_date: Mapped[date | None] = mapped_column(Date)
    identification_number: Mapped[str | None] = mapped_column(
        EncryptedType(String(255), settings.field_encryption_key, FernetEngine, 'utf-8')
    )
    emergency_contact_name: Mapped[str | None] = mapped_column(String(160))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(40))

    user: Mapped[User] = relationship(back_populates="traveler_profile")


class HostProfile(Base, TimestampMixin):
    __tablename__ = "host_profiles"
    __table_args__ = (UniqueConstraint("user_id", name="uq_host_profiles_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    phone: Mapped[str | None] = mapped_column(String(40))
    bio: Mapped[str | None] = mapped_column(Text)
    response_rate: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    response_time_minutes: Mapped[int | None] = mapped_column(Integer)
    average_rating: Mapped[float] = mapped_column(Float, default=0, nullable=False)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified_badge: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    government_id_status: Mapped[VerificationStatus] = mapped_column(Enum(VerificationStatus), default=VerificationStatus.unverified, nullable=False, index=True)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    onboarding_exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="host_profile")


class Hotel(Base, TimestampMixin):
    __tablename__ = "hotels"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    brand_name: Mapped[str | None] = mapped_column(String(180))
    description: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(100), default="Morocco", nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(255))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    star_rating: Mapped[float | None] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner: Mapped[User | None] = relationship()
    properties: Mapped[list[Property]] = relationship(back_populates="hotel")


class Property(Base, TimestampMixin):
    __tablename__ = "properties"
    __table_args__ = (
        Index("ix_properties_search", "city", "neighborhood", "kind", "rating"),
        Index("ix_properties_advanced_search", "country", "city", "property_type", "price_per_night", "average_rating"),
        CheckConstraint("base_price >= 0", name="ck_properties_base_price_non_negative"),
        CheckConstraint("capacity > 0", name="ck_properties_capacity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    hotel_id: Mapped[int | None] = mapped_column(ForeignKey("hotels.id", ondelete="SET NULL"), index=True)
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    name: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    title: Mapped[str | None] = mapped_column(String(180), index=True)
    kind: Mapped[PropertyKind] = mapped_column(Enum(PropertyKind), nullable=False, index=True)
    property_type: Mapped[str | None] = mapped_column(String(60), index=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    country: Mapped[str] = mapped_column(String(100), default="Morocco", nullable=False, index=True)
    address: Mapped[str | None] = mapped_column(String(255))
    location: Mapped[str] = mapped_column(String(255), nullable=False)
    neighborhood: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_per_night: Mapped[float | None] = mapped_column(Numeric(10, 2))
    cleaning_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    service_fee: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    rating: Mapped[float] = mapped_column(Float, default=0, nullable=False, index=True)
    average_rating: Mapped[float] = mapped_column(Float, default=0, nullable=False, index=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    image_url: Mapped[str] = mapped_column(String(500), nullable=False)
    gallery: Mapped[list[str]] = mapped_column(JsonListType, default=list, nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    max_guests: Mapped[int | None] = mapped_column(Integer)
    bedrooms: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    bathrooms: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    beds: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    tags: Mapped[list[str]] = mapped_column(JsonListType, default=list, nullable=False)
    host_name: Mapped[str] = mapped_column(String(160), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    available_from: Mapped[date | None] = mapped_column(Date, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    draft_data: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)
    dynamic_pricing_note: Mapped[str] = mapped_column(Text, default="", nullable=False)
    search_vector: Mapped[str] = mapped_column(Text, default="", nullable=False)

    hotel: Mapped[Hotel | None] = relationship(back_populates="properties")
    owner: Mapped[User | None] = relationship()
    apartment: Mapped[Apartment | None] = relationship(back_populates="property", cascade="all, delete-orphan")
    amenities: Mapped[list[Amenity]] = relationship(secondary=property_amenities, back_populates="properties")
    room_types: Mapped[list[RoomType]] = relationship(back_populates="property", cascade="all, delete-orphan")
    rooms: Mapped[list[Room]] = relationship(back_populates="property", cascade="all, delete-orphan")
    bookings: Mapped[list[Booking]] = relationship(back_populates="property")
    reviews: Mapped[list[Review]] = relationship(back_populates="property", cascade="all, delete-orphan")
    images: Mapped[list[ImageAsset]] = relationship(back_populates="property", cascade="all, delete-orphan")
    property_images: Mapped[list[PropertyImage]] = relationship(back_populates="property", cascade="all, delete-orphan", order_by="PropertyImage.sort_order")
    availability_calendar: Mapped[list[AvailabilityCalendar]] = relationship(back_populates="property", cascade="all, delete-orphan")


class Apartment(Base, TimestampMixin):
    __tablename__ = "apartments"
    __table_args__ = (UniqueConstraint("property_id", name="uq_apartments_property_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)
    floor: Mapped[int | None] = mapped_column(Integer)
    bedrooms: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    bathrooms: Mapped[float] = mapped_column(Float, default=1, nullable=False)
    square_meters: Mapped[int | None] = mapped_column(Integer)
    kitchen: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    property: Mapped[Property] = relationship(back_populates="apartment")


class Amenity(Base, TimestampMixin):
    __tablename__ = "amenities"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), default="general", nullable=False)

    properties: Mapped[list[Property]] = relationship(secondary=property_amenities, back_populates="amenities")
    rooms: Mapped[list[Room]] = relationship(secondary=room_amenities, back_populates="amenities")


class RoomType(Base, TimestampMixin):
    __tablename__ = "room_types"
    __table_args__ = (CheckConstraint("base_price_modifier >= 0", name="ck_room_types_modifier_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    base_price_modifier: Mapped[float] = mapped_column(Numeric(10, 2), default=0, nullable=False)
    sleeps: Mapped[int] = mapped_column(Integer, nullable=False)

    property: Mapped[Property] = relationship(back_populates="room_types")
    rooms: Mapped[list[Room]] = relationship(back_populates="room_type", cascade="all, delete-orphan")


class Room(Base, TimestampMixin):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("property_id", "room_number", name="uq_rooms_property_room_number"),
        CheckConstraint("capacity > 0", name="ck_rooms_capacity_positive"),
        CheckConstraint("inventory_count > 0", name="ck_rooms_inventory_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)
    room_type_id: Mapped[int | None] = mapped_column(ForeignKey("room_types.id", ondelete="SET NULL"), index=True)
    room_number: Mapped[str] = mapped_column(String(80), nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    inventory_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    images: Mapped[list[str]] = mapped_column(JsonListType, default=list, nullable=False)

    property: Mapped[Property] = relationship(back_populates="rooms")
    room_type: Mapped[RoomType | None] = relationship(back_populates="rooms")
    amenities: Mapped[list[Amenity]] = relationship(secondary=room_amenities, back_populates="rooms")
    bookings: Mapped[list[Booking]] = relationship(back_populates="room")


class ImageAsset(Base, TimestampMixin):
    __tablename__ = "image_assets"

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), index=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    property: Mapped[Property | None] = relationship(back_populates="images")


class PropertyImage(Base, TimestampMixin):
    __tablename__ = "property_images"
    __table_args__ = (
        UniqueConstraint("property_id", "sort_order", name="uq_property_images_sort_order"),
        Index("ix_property_images_cover", "property_id", "is_cover"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    alt_text: Mapped[str | None] = mapped_column(String(255))
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(40), default="local", nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    size_bytes: Mapped[int | None] = mapped_column(Integer)

    property: Mapped[Property] = relationship(back_populates="property_images")


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"
    __table_args__ = (
        Index("ix_bookings_overlap_lookup", "property_id", "room_id", "check_in", "check_out", "status"),
        CheckConstraint("check_in < check_out", name="ck_bookings_valid_date_range"),
        CheckConstraint("traveler_count > 0", name="ck_bookings_traveler_count_positive"),
        CheckConstraint("total_amount >= 0", name="ck_bookings_total_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_reference: Mapped[str] = mapped_column(String(40), unique=True, nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="RESTRICT"), nullable=False, index=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"), index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    traveler_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), default=BookingStatus.pending, nullable=False, index=True)
    special_requests: Mapped[str | None] = mapped_column(Text)
    arrival_time: Mapped[str | None] = mapped_column(String(20))
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    pricing_breakdown: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)

    user: Mapped[User | None] = relationship(back_populates="bookings")
    property: Mapped[Property] = relationship(back_populates="bookings")
    room: Mapped[Room | None] = relationship(back_populates="bookings")
    history: Mapped[list[BookingStatusHistory]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    reviews: Mapped[list[Review]] = relationship(back_populates="booking")
    payments: Mapped[list[Payment]] = relationship(back_populates="booking", cascade="all, delete-orphan")
    travelers: Mapped[list[Traveler]] = relationship(back_populates="booking", cascade="all, delete-orphan")


class Traveler(Base, TimestampMixin):
    __tablename__ = "travelers"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    nationality: Mapped[str] = mapped_column(String(100), nullable=False)
    birth_date: Mapped[date] = mapped_column(Date, nullable=False)
    passport_number: Mapped[str] = mapped_column(
        EncryptedType(String(255), settings.field_encryption_key, FernetEngine, 'utf-8'),
        nullable=False
    )
    gender: Mapped[str | None] = mapped_column(String(20))
    relationship_to_primary_guest: Mapped[str | None] = mapped_column(String(100))

    booking: Mapped[Booking] = relationship(back_populates="travelers")


class BookingStatusHistory(Base):
    __tablename__ = "booking_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    from_status: Mapped[BookingStatus | None] = mapped_column(Enum(BookingStatus))
    to_status: Mapped[BookingStatus] = mapped_column(Enum(BookingStatus), nullable=False)
    changed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    reason: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False)

    booking: Mapped[Booking] = relationship(back_populates="history")
    changed_by: Mapped[User | None] = relationship()


class Review(Base, TimestampMixin):
    __tablename__ = "reviews"
    __table_args__ = (
        UniqueConstraint("booking_id", "user_id", name="uq_reviews_booking_user"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_reviews_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"), index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    author_name: Mapped[str] = mapped_column(String(160), nullable=False)
    role_label: Mapped[str] = mapped_column(String(120), default="Verified guest", nullable=False)
    avatar_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    verified_booking: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    property: Mapped[Property] = relationship(back_populates="reviews")
    booking: Mapped[Booking | None] = relationship(back_populates="reviews")
    user: Mapped[User | None] = relationship(back_populates="reviews")
    images: Mapped[list[ReviewImage]] = relationship(back_populates="review", cascade="all, delete-orphan")


class ReviewImage(Base, TimestampMixin):
    __tablename__ = "review_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    review: Mapped[Review] = relationship(back_populates="images")


class HostReview(Base, TimestampMixin):
    __tablename__ = "host_reviews"
    __table_args__ = (
        UniqueConstraint("booking_id", "reviewer_id", "host_id", name="uq_host_reviews_booking_reviewer_host"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_host_reviews_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)

    booking: Mapped[Booking] = relationship()
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewer_id])
    host: Mapped[User] = relationship(back_populates="host_reviews_received", foreign_keys=[host_id])


class TravelerReview(Base, TimestampMixin):
    __tablename__ = "traveler_reviews"
    __table_args__ = (
        UniqueConstraint("booking_id", "reviewer_id", "traveler_id", name="uq_traveler_reviews_booking_reviewer_traveler"),
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_traveler_reviews_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    reviewer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    traveler_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False)

    booking: Mapped[Booking] = relationship()
    reviewer: Mapped[User | None] = relationship(foreign_keys=[reviewer_id])
    traveler: Mapped[User] = relationship(back_populates="traveler_reviews_received", foreign_keys=[traveler_id])


class Favorite(Base, TimestampMixin):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "favorite_type", "target_id", name="uq_favorites_user_target"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    favorite_type: Mapped[FavoriteType] = mapped_column(Enum(FavoriteType), nullable=False)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False)

    user: Mapped[User] = relationship(back_populates="favorites")


class Wishlist(Base, TimestampMixin):
    __tablename__ = "wishlists"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uq_wishlists_user_name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship(back_populates="wishlists")
    items: Mapped[list[WishlistItem]] = relationship(back_populates="wishlist", cascade="all, delete-orphan")


class WishlistItem(Base, TimestampMixin):
    __tablename__ = "wishlist_items"
    __table_args__ = (UniqueConstraint("wishlist_id", "property_id", name="uq_wishlist_items_property"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    wishlist_id: Mapped[int] = mapped_column(ForeignKey("wishlists.id", ondelete="CASCADE"), nullable=False, index=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)

    wishlist: Mapped[Wishlist] = relationship(back_populates="items")
    property: Mapped[Property] = relationship()


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_provider_transaction", "provider", "transaction_id"),
        CheckConstraint("amount >= 0", name="ck_payments_amount_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    provider: Mapped[PaymentProvider] = mapped_column(Enum(PaymentProvider), nullable=False, index=True)
    status: Mapped[PaymentStatus] = mapped_column(Enum(PaymentStatus), default=PaymentStatus.pending, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    transaction_id: Mapped[str | None] = mapped_column(String(160), index=True)
    refund_status: Mapped[RefundStatus] = mapped_column(Enum(RefundStatus), default=RefundStatus.none, nullable=False, index=True)
    invoice_url: Mapped[str | None] = mapped_column(String(500))
    receipt_url: Mapped[str | None] = mapped_column(String(500))
    provider_payload: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)

    booking: Mapped[Booking] = relationship(back_populates="payments")
    user: Mapped[User | None] = relationship(back_populates="payments")


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"
    __table_args__ = (
        Index("ix_conversations_participants", "traveler_id", "host_id"),
        UniqueConstraint("booking_id", "traveler_id", "host_id", name="uq_conversations_booking_participants"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int | None] = mapped_column(ForeignKey("properties.id", ondelete="SET NULL"), index=True)
    booking_id: Mapped[int | None] = mapped_column(ForeignKey("bookings.id", ondelete="SET NULL"), index=True)
    traveler_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    property: Mapped[Property | None] = relationship()
    booking: Mapped[Booking | None] = relationship()
    traveler: Mapped[User] = relationship(foreign_keys=[traveler_id])
    host: Mapped[User] = relationship(foreign_keys=[host_id])
    messages: Mapped[list[Message]] = relationship(back_populates="conversation", cascade="all, delete-orphan")


class Message(Base, TimestampMixin):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_created", "conversation_id", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    body: Mapped[str | None] = mapped_column(Text)
    image_url: Mapped[str | None] = mapped_column(String(500))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    sender: Mapped[User | None] = relationship()


class UserSession(Base, TimestampMixin):
    __tablename__ = "user_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refresh_token_jti: Mapped[str] = mapped_column(String(80), unique=True, nullable=False, index=True)
    user_agent: Mapped[str | None] = mapped_column(String(500))
    ip_address: Mapped[str | None] = mapped_column(String(80))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    user: Mapped[User] = relationship(back_populates="sessions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(80), index=True)
    entity_id: Mapped[str | None] = mapped_column(String(80), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(80))
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, server_default=func.now(), nullable=False, index=True)

    actor: Mapped[User | None] = relationship()


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str | None] = mapped_column(String(320), index=True)
    notification_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    subject: Mapped[str] = mapped_column(String(180), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[str] = mapped_column(String(40), default="in_app", nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User | None] = relationship(back_populates="notifications")


class SavedSearch(Base, TimestampMixin):
    __tablename__ = "saved_searches"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_saved_searches_user_name"),
        Index("ix_saved_searches_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    query: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)
    alert_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    user: Mapped[User] = relationship(back_populates="saved_searches")


class NotificationPreference(Base, TimestampMixin):
    __tablename__ = "notification_preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_notification_preferences_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_updates: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    messages: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    reviews: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    security_alerts: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    marketing: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    channels: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=lambda: {"inApp": True, "email": True}, nullable=False)

    user: Mapped[User] = relationship(back_populates="notification_preferences")


class AccountPreference(Base, TimestampMixin):
    __tablename__ = "account_preferences"
    __table_args__ = (UniqueConstraint("user_id", name="uq_account_preferences_user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    locale: Mapped[str] = mapped_column(String(16), default="en-US", nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    timezone: Mapped[str] = mapped_column(String(80), default="UTC", nullable=False)
    privacy: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)
    settings: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)

    user: Mapped[User] = relationship(back_populates="account_preferences")


class SupportTicket(Base, TimestampMixin):
    __tablename__ = "support_tickets"
    __table_args__ = (
        Index("ix_support_tickets_status_priority", "status", "priority"),
        Index("ix_support_tickets_user_created", "user_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    assigned_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    subject: Mapped[str] = mapped_column(String(180), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), default="general", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False, index=True)
    resolution: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User | None] = relationship(foreign_keys=[user_id])
    assigned_admin: Mapped[User | None] = relationship(foreign_keys=[assigned_admin_id])


class Dispute(Base, TimestampMixin):
    __tablename__ = "disputes"
    __table_args__ = (
        Index("ix_disputes_status_created", "status", "created_at"),
        Index("ix_disputes_booking_status", "booking_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)
    opened_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    assigned_admin_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False, index=True)
    resolution: Mapped[str | None] = mapped_column(Text)

    booking: Mapped[Booking] = relationship()
    opened_by: Mapped[User | None] = relationship(foreign_keys=[opened_by_id])
    assigned_admin: Mapped[User | None] = relationship(foreign_keys=[assigned_admin_id])


class Report(Base, TimestampMixin):
    __tablename__ = "reports"
    __table_args__ = (
        Index("ix_reports_target", "target_type", "target_id"),
        Index("ix_reports_status_created", "status", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    target_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    target_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False, index=True)
    resolution: Mapped[str | None] = mapped_column(Text)

    reporter: Mapped[User | None] = relationship()


class RiskEvent(Base, TimestampMixin):
    __tablename__ = "risk_events"
    __table_args__ = (
        Index("ix_risk_events_status_severity", "status", "severity"),
        Index("ix_risk_events_entity", "entity_type", "entity_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False, index=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    signal_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(20), default="low", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), default="open", nullable=False, index=True)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    resolved_by: Mapped[User | None] = relationship()


class Payout(Base, TimestampMixin):
    __tablename__ = "payouts"
    __table_args__ = (
        Index("ix_payouts_host_status", "host_id", "status"),
        CheckConstraint("amount >= 0", name="ck_payouts_amount_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    host_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="scheduled", nullable=False, index=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    provider_payload: Mapped[dict[str, Any]] = mapped_column(JsonDictType, default=dict, nullable=False)

    host: Mapped[User] = relationship()


class AvailabilityCalendar(Base, TimestampMixin):
    __tablename__ = "availability_calendars"
    __table_args__ = (
        UniqueConstraint("property_id", "room_id", "calendar_date", name="uq_availability_date"),
        CheckConstraint("available_units >= 0", name="ck_availability_units_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"), nullable=False, index=True)
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="CASCADE"), index=True)
    calendar_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    available_units: Mapped[int] = mapped_column(Integer, nullable=False)
    min_nights: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    price_override: Mapped[float | None] = mapped_column(Numeric(10, 2))

    property: Mapped[Property] = relationship(back_populates="availability_calendar")
