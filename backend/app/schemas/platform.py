from __future__ import annotations

from datetime import datetime
from datetime import date

from pydantic import BaseModel, Field

from app.models import PaymentProvider, PaymentStatus, RefundStatus
from app.schemas.base import CamelInputModel


class ProfileUpdate(CamelInputModel):
    field_aliases = {"fullName": "full_name", "avatarUrl": "avatar_url"}

    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None
    bio: str | None = None


class WishlistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str | None = None


class WishlistItemCreate(CamelInputModel):
    field_aliases = {"propertyId": "property_id"}
    property_id: int


class PropertyImageCreate(CamelInputModel):
    field_aliases = {"altText": "alt_text", "sortOrder": "sort_order", "isCover": "is_cover"}

    url: str
    alt_text: str | None = None
    sort_order: int = 0
    is_cover: bool = False


class PropertyImageReorder(CamelInputModel):
    field_aliases = {"imageIds": "image_ids"}
    image_ids: list[int]


class PaymentCreate(CamelInputModel):
    field_aliases = {"bookingId": "booking_id"}
    booking_id: int
    provider: PaymentProvider


class PaymentConfirm(CamelInputModel):
    field_aliases = {
        "transactionId": "transaction_id",
        "invoiceUrl": "invoice_url",
        "receiptUrl": "receipt_url",
        "providerPayload": "provider_payload",
    }

    status: PaymentStatus
    transaction_id: str | None = None
    invoice_url: str | None = None
    receipt_url: str | None = None
    provider_payload: dict = Field(default_factory=dict)


class RefundUpdate(CamelInputModel):
    field_aliases = {"refundStatus": "refund_status"}
    refund_status: RefundStatus


class ConversationCreate(CamelInputModel):
    field_aliases = {"propertyId": "property_id", "bookingId": "booking_id", "hostId": "host_id"}

    property_id: int | None = None
    booking_id: int | None = None
    host_id: int


class MessageCreate(CamelInputModel):
    field_aliases = {"imageUrl": "image_url"}

    body: str | None = None
    image_url: str | None = None


class ReviewImageIn(CamelInputModel):
    url: str


class PropertyReviewCreate(CamelInputModel):
    field_aliases = {"propertyId": "property_id", "bookingId": "booking_id", "imageUrls": "image_urls"}

    property_id: int
    booking_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3)
    image_urls: list[str] = Field(default_factory=list)


class HostReviewCreate(CamelInputModel):
    field_aliases = {"bookingId": "booking_id", "hostId": "host_id"}

    booking_id: int
    host_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3)


class StayReviewCreate(CamelInputModel):
    field_aliases = {
        "propertyId": "property_id",
        "bookingId": "booking_id",
        "hostId": "host_id",
        "apartmentRating": "apartment_rating",
        "apartmentComment": "apartment_comment",
        "hostRating": "host_rating",
        "hostComment": "host_comment",
        "imageUrls": "image_urls",
    }

    property_id: int
    booking_id: int
    host_id: int
    apartment_rating: int = Field(ge=1, le=5)
    apartment_comment: str = Field(min_length=3)
    host_rating: int = Field(ge=1, le=5)
    host_comment: str = Field(min_length=3)
    image_urls: list[str] = Field(default_factory=list)


class TravelerReviewCreate(CamelInputModel):
    field_aliases = {"bookingId": "booking_id", "travelerId": "traveler_id"}

    booking_id: int
    traveler_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3)


class DashboardMetric(BaseModel):
    label: str
    value: str
    detail: str | None = None
    change: str | None = None


class WebsocketToken(BaseModel):
    token: str
    expires_at: datetime


class SavedSearchCreate(CamelInputModel):
    field_aliases = {"alertEnabled": "alert_enabled"}

    name: str = Field(min_length=1, max_length=140)
    query: dict = Field(default_factory=dict)
    alert_enabled: bool = True


class CalendarRowUpdate(CamelInputModel):
    field_aliases = {"calendarDate": "calendar_date", "availableUnits": "available_units", "minNights": "min_nights", "priceOverride": "price_override", "roomId": "room_id"}

    calendar_date: date
    room_id: int | None = None
    available_units: int = Field(ge=0)
    min_nights: int = Field(default=1, ge=1)
    closed: bool = False
    price_override: float | None = Field(default=None, ge=0)


class CalendarBulkUpdate(CamelInputModel):
    rows: list[CalendarRowUpdate] = Field(min_length=1, max_length=370)


class NotificationPreferenceUpdate(CamelInputModel):
    field_aliases = {"bookingUpdates": "booking_updates", "securityAlerts": "security_alerts"}

    booking_updates: bool | None = None
    messages: bool | None = None
    reviews: bool | None = None
    security_alerts: bool | None = None
    marketing: bool | None = None
    channels: dict | None = None


class AccountPreferenceUpdate(CamelInputModel):
    locale: str | None = Field(default=None, max_length=16)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    timezone: str | None = Field(default=None, max_length=80)
    privacy: dict | None = None
    settings: dict | None = None


class SupportTicketCreate(CamelInputModel):
    subject: str = Field(min_length=3, max_length=180)
    body: str = Field(min_length=3)
    category: str = Field(default="general", max_length=80)
    priority: str = Field(default="normal", max_length=20)


class SupportTicketUpdate(CamelInputModel):
    field_aliases = {"assignedAdminId": "assigned_admin_id"}

    status: str | None = Field(default=None, max_length=30)
    priority: str | None = Field(default=None, max_length=20)
    assigned_admin_id: int | None = None
    resolution: str | None = None


class DisputeCreate(CamelInputModel):
    field_aliases = {"bookingId": "booking_id"}

    booking_id: int
    reason: str = Field(min_length=3)


class DisputeUpdate(CamelInputModel):
    field_aliases = {"assignedAdminId": "assigned_admin_id"}

    status: str | None = Field(default=None, max_length=30)
    assigned_admin_id: int | None = None
    resolution: str | None = None


class ReportCreate(CamelInputModel):
    field_aliases = {"targetType": "target_type", "targetId": "target_id"}

    target_type: str = Field(min_length=2, max_length=60)
    target_id: int
    reason: str = Field(min_length=3)


class ReportUpdate(CamelInputModel):
    status: str | None = Field(default=None, max_length=30)
    resolution: str | None = None


class RiskEventCreate(CamelInputModel):
    field_aliases = {"entityType": "entity_type", "entityId": "entity_id", "signalType": "signal_type", "metadataJson": "metadata_json"}

    entity_type: str = Field(min_length=2, max_length=60)
    entity_id: int
    signal_type: str = Field(min_length=2, max_length=80)
    severity: str = Field(default="low", max_length=20)
    metadata_json: dict = Field(default_factory=dict)


class RiskEventUpdate(CamelInputModel):
    status: str | None = Field(default=None, max_length=30)
    severity: str | None = Field(default=None, max_length=20)
