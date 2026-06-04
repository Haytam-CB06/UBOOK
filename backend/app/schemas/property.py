from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.base import CamelInputModel


class ReviewOut(BaseModel):
    id: int
    author: str
    role: str
    avatar: str
    rating: int
    comment: str


class RoomOptionOut(BaseModel):
    id: str
    name: str
    description: str
    priceModifier: float
    sleeps: int


class AvailabilitySlotOut(BaseModel):
    label: str
    status: Literal["Open", "Limited", "Closed"]


class PropertyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    name: str
    title: str | None = None
    type: str
    propertyType: str | None = None
    country: str | None = None
    city: str
    address: str | None = None
    location: str
    neighborhood: str
    coordinates: tuple[float, float]
    price: float
    pricePerNight: float | None = None
    cleaningFee: float = 0
    serviceFee: float = 0
    rating: float
    averageRating: float | None = None
    reviewCount: int
    image: str
    coverImage: str | None = None
    gallery: list[str]
    amenities: list[str]
    capacity: int
    maxGuests: int | None = None
    bedrooms: int = 1
    bathrooms: float = 1
    beds: int = 1
    description: str
    tags: list[str]
    host: str
    hostId: int | None = None
    hostAvatar: str | None = None
    hostSince: str | None = None
    hostRating: float = 0
    hostReviewsCount: int = 0
    verified: bool
    isActive: bool = True
    availableFrom: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    dynamicPricingNote: str
    roomOptions: list[RoomOptionOut]
    availability: list[AvailabilitySlotOut]
    reviews: list[ReviewOut]


class PropertyCreate(CamelInputModel):
    field_aliases = {
        "dynamicPricingNote": "dynamic_pricing_note",
        "propertyType": "property_type",
        "pricePerNight": "price_per_night",
        "cleaningFee": "cleaning_fee",
        "serviceFee": "service_fee",
        "maxGuests": "max_guests",
        "availableFrom": "available_from",
        "isActive": "is_active",
    }
    name: str | None = None
    title: str | None = None
    type: Literal["Riad", "Riyad", "Apartment", "House", "Hotel", "Villa", "Resort", "Cabin", "riad", "riyad", "apartment", "house", "hotel", "villa", "resort", "cabin"] | None = None
    property_type: str | None = None
    city: str
    country: str = "Morocco"
    address: str | None = None
    location: str | None = None
    neighborhood: str | None = None
    latitude: float
    longitude: float
    price: float | None = Field(default=None, gt=0)
    price_per_night: float | None = Field(default=None, gt=0)
    cleaning_fee: float = Field(default=0, ge=0)
    service_fee: float = Field(default=0, ge=0)
    capacity: int | None = Field(default=None, gt=0)
    max_guests: int | None = Field(default=None, gt=0)
    bedrooms: int = Field(default=1, ge=0)
    bathrooms: float = Field(default=1, ge=0)
    beds: int = Field(default=1, ge=0)
    description: str
    image: str | None = None
    gallery: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    host: str | None = None
    verified: bool = False
    is_active: bool = True
    available_from: date | None = None
    dynamic_pricing_note: str = ""


class HotelCreate(CamelInputModel):
    field_aliases = {"brandName": "brand_name", "starRating": "star_rating"}
    name: str
    brand_name: str | None = None
    description: str | None = None
    city: str
    country: str = "Morocco"
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    star_rating: float | None = None
    verified: bool = False


class HotelOut(HotelCreate):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int


class RoomCreate(CamelInputModel):
    field_aliases = {
        "propertyId": "property_id",
        "roomTypeId": "room_type_id",
        "roomNumber": "room_number",
        "basePrice": "base_price",
        "inventoryCount": "inventory_count",
    }

    property_id: int
    room_type_id: int | None = None
    room_number: str
    name: str
    capacity: int = Field(gt=0)
    base_price: float = Field(gt=0)
    inventory_count: int = Field(default=1, gt=0)
    images: list[str] = Field(default_factory=list)
    amenities: list[str] = Field(default_factory=list)


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    property_id: int = Field(serialization_alias="propertyId")
    room_type_id: int | None = Field(serialization_alias="roomTypeId")
    room_number: str = Field(serialization_alias="roomNumber")
    name: str
    capacity: int
    base_price: float = Field(serialization_alias="basePrice")
    inventory_count: int = Field(serialization_alias="inventoryCount")
    active: bool
    images: list[str]
    amenities: list[str]


class AvailabilityRequest(CamelInputModel):
    field_aliases = {"checkIn": "check_in", "checkOut": "check_out"}
    check_in: date
    check_out: date
    guests: int = Field(default=1, gt=0)


class AvailabilityResponse(BaseModel):
    property_id: int = Field(serialization_alias="propertyId")
    check_in: date = Field(serialization_alias="checkIn")
    check_out: date = Field(serialization_alias="checkOut")
    available: bool
    remaining_units: int = Field(serialization_alias="remainingUnits")
    room_id: int | None = Field(default=None, serialization_alias="roomId")


class PricingRequest(CamelInputModel):
    field_aliases = {"checkIn": "check_in", "checkOut": "check_out"}
    check_in: date | None = None
    check_out: date | None = None
    nights: int | None = Field(default=None, gt=0)
    guests: int = Field(default=1, gt=0)


class PricingResponse(BaseModel):
    nightlyRate: float
    subtotal: float
    serviceFee: float
    cityTax: float
    total: float
    currency: str = "USD"
    breakdown: list[dict[str, float | str]]


class ReviewCreate(CamelInputModel):
    field_aliases = {"propertyId": "property_id", "bookingId": "booking_id"}
    property_id: int
    booking_id: int
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3)
