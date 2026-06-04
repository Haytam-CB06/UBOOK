from datetime import date

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import BookingStatus
from app.schemas.base import CamelInputModel


class BookingCreate(CamelInputModel):
    field_aliases = {
        "propertyId": "property_id",
        "roomId": "room_id",
        "fullName": "full_name",
        "checkIn": "check_in",
        "checkOut": "check_out",
    }

    property_id: int
    room_id: int | None = None
    full_name: str
    email: EmailStr
    guests: int = Field(gt=0)
    check_in: date
    check_out: date
    notes: str | None = None


class BookingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    booking_id: str = Field(serialization_alias="bookingId")
    booking_reference: str = Field(serialization_alias="bookingReference")
    property_id: int = Field(serialization_alias="propertyId")
    property_name: str = Field(serialization_alias="propertyName")
    city: str
    dates: str
    nights: int
    status: str
    total: float
    payload: dict | None = None


class BookingStatusUpdate(BaseModel):
    status: BookingStatus
    reason: str | None = None
