from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models import Amenity, HostProfile, Property, PropertyImage, PropertyKind, Review, Role, Room, RoomType, TravelerProfile, User

ADMIN_EMAIL = "admin@ubook.ma"
ADMIN_PASSWORD = "AdminPass123!"
OWNER_EMAIL = "owner@ubook.ma"
OWNER_PASSWORD = "OwnerPass123!"
GUEST_EMAIL = "guest@ubook.ma"
GUEST_PASSWORD = "GuestPass123!"


def _user(db: Session, *, email: str, name: str, role: Role, password: str) -> User:
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        return existing
    user = User(email=email, full_name=name, role=role, password_hash=hash_password(password), is_active=True)
    db.add(user)
    db.flush()
    return user


def _amenities(db: Session, names: list[str]) -> list[Amenity]:
    values: list[Amenity] = []
    for name in names:
        amenity = db.query(Amenity).filter(Amenity.name == name).first()
        if not amenity:
            amenity = Amenity(name=name)
            db.add(amenity)
            db.flush()
        values.append(amenity)
    return values


def seed_database(db: Session) -> None:
    admin = _user(db, email=ADMIN_EMAIL, name="UBOOK Admin", role=Role.super_admin, password=ADMIN_PASSWORD)
    owner = _user(db, email=OWNER_EMAIL, name="Leila Benyoussef", role=Role.hotel_admin, password=OWNER_PASSWORD)
    guest = _user(db, email=GUEST_EMAIL, name="Amina El Mansouri", role=Role.guest, password=GUEST_PASSWORD)
    if not owner.host_profile:
        db.add(HostProfile(user_id=owner.id, verified_badge=True, response_rate=98, response_time_minutes=45))
    if not guest.traveler_profile:
        db.add(TravelerProfile(user_id=guest.id))

    if db.query(Property).count() > 0:
        db.commit()
        return

    properties = [
        {
            "name": "Riad Zellige Medina",
            "kind": PropertyKind.riad,
            "city": "Marrakech",
            "country": "Morocco",
            "location": "Medina, 6 min from Jemaa el-Fna",
            "neighborhood": "Medina",
            "latitude": 31.6258,
            "longitude": -7.9892,
            "base_price": 182,
            "rating": 4.9,
            "review_count": 2,
            "image_url": "/images/ubook/property-riad.png",
            "gallery": ["/images/ubook/property-riad.png", "/images/ubook/hero.png", "/images/ubook/property-rooftop.png"],
            "capacity": 4,
            "description": "A restored Marrakech riad with courtyard calm, concierge precision, and verified arrival guidance.",
            "tags": ["Top destination", "Verified host", "Flexible breakfast"],
            "host_name": "Leila & Yassine",
            "verified": True,
            "dynamic_pricing_note": "Rates rise on festival weekends and soften for midweek arrivals outside peak periods.",
            "amenities": ["Plunge pool", "Rooftop breakfast", "Airport transfer", "Private hammam"],
            "rooms": [
                ("riad-classic", "Courtyard Suite", "One king room with marble bathroom and breakfast.", 0, 2, 2),
                ("riad-family", "Family Mezzanine", "Two sleeping zones with private terrace access.", 46, 4, 1),
            ],
            "reviews": [
                ("Maya R.", "Guest from London", 5, "Arrival assistance made old-city navigation effortless."),
                ("Julien C.", "Guest from Lyon", 5, "Elegant, calm, and close to the action without confusion."),
            ],
        },
        {
            "name": "Palmeraie Garden Villa",
            "kind": PropertyKind.house,
            "city": "Marrakech",
            "country": "Morocco",
            "location": "Palmeraie, private garden estate",
            "neighborhood": "Palmeraie",
            "latitude": 31.6774,
            "longitude": -7.9609,
            "base_price": 310,
            "rating": 4.8,
            "review_count": 1,
            "image_url": "/images/ubook/property-villa.png",
            "gallery": ["/images/ubook/property-villa.png", "/images/ubook/property-house.png", "/images/ubook/property-rooftop.png"],
            "capacity": 8,
            "description": "A staffed private villa for families and groups seeking calm outside central Marrakech.",
            "tags": ["Private pool", "Family ready", "Staffed villa"],
            "host_name": "Atlas Villa Collection",
            "verified": True,
            "dynamic_pricing_note": "Premium applies during holidays, golf weeks, and late-booking family demand.",
            "amenities": ["Private pool", "Garden terrace", "Chef on request", "Driver coordination"],
            "rooms": [
                ("villa-main", "Garden Villa", "Four-bedroom house with pool and shaded dining.", 0, 8, 1),
            ],
            "reviews": [("Karim A.", "Family organizer from Casablanca", 5, "Transfers, dinner timing, and arrival were handled without friction.")],
        },
        {
            "name": "Gueliz Design Apartment",
            "kind": PropertyKind.apartment,
            "city": "Marrakech",
            "country": "Morocco",
            "location": "Gueliz, near Carré Eden",
            "neighborhood": "Gueliz",
            "latitude": 31.6347,
            "longitude": -8.0105,
            "base_price": 128,
            "rating": 4.7,
            "review_count": 1,
            "image_url": "/images/ubook/property-apartment.png",
            "gallery": ["/images/ubook/property-apartment.png", "/images/ubook/property-rooftop.png"],
            "capacity": 3,
            "description": "A bright city apartment for walkable restaurants, work trips, and clean self check-in.",
            "tags": ["Long stay", "Workspace", "Walkable"],
            "host_name": "Gueliz Homes",
            "verified": True,
            "dynamic_pricing_note": "Weekly stays unlock savings while event weeks lift pricing.",
            "amenities": ["Fast Wi-Fi", "Workspace", "Self check-in", "Balcony seating"],
            "rooms": [
                ("gueliz-standard", "City Studio", "Open-plan apartment with queen bed and dining nook.", 0, 2, 2),
            ],
            "reviews": [("Lina M.", "Remote guest from Berlin", 5, "Curated for work and leisure with quiet nights.")],
        },
        {
            "name": "Casablanca Corniche Hotel",
            "kind": PropertyKind.hotel,
            "city": "Casablanca",
            "country": "Morocco",
            "location": "Ain Diab Corniche",
            "neighborhood": "Ain Diab",
            "latitude": 33.5963,
            "longitude": -7.6696,
            "base_price": 205,
            "rating": 4.6,
            "review_count": 1,
            "image_url": "/images/ubook/property-hotel.png",
            "gallery": ["/images/ubook/property-hotel.png", "/images/ubook/property-riad.png"],
            "capacity": 2,
            "description": "A polished business and leisure hotel with front-desk certainty on the Atlantic corniche.",
            "tags": ["24/7 reception", "Business ready", "Sea access"],
            "host_name": "Corniche Hospitality",
            "verified": True,
            "dynamic_pricing_note": "Rates rise during business events and high-demand coastal weekends.",
            "amenities": ["24/7 reception", "Spa access", "Breakfast included", "Late arrival desk"],
            "rooms": [
                ("corniche-deluxe", "Deluxe City Room", "Warm room styling with breakfast and concierge planning.", 0, 2, 10),
            ],
            "reviews": [("Sofia D.", "Solo traveler from Madrid", 5, "Verified arrival details and front desk responsiveness were exactly right.")],
        },
    ]

    for item in properties:
        amenities = _amenities(db, item.pop("amenities"))
        rooms = item.pop("rooms")
        reviews = item.pop("reviews")
        property_ = Property(
            owner_id=owner.id,
            title=item["name"],
            property_type=item["kind"].value,
            address=item["location"],
            price_per_night=item["base_price"],
            cleaning_fee=25,
            service_fee=round(float(item["base_price"]) * 0.08, 2),
            max_guests=item["capacity"],
            bedrooms=max(1, item["capacity"] // 2),
            bathrooms=1,
            beds=max(1, item["capacity"] // 2),
            average_rating=item["rating"],
            is_active=True,
            search_vector=" ".join([item["name"], item["city"], item["location"], item["neighborhood"], item["description"]]).lower(),
            **item,
        )
        property_.amenities = amenities
        db.add(property_)
        db.flush()
        for index, image in enumerate(property_.gallery or [property_.image_url]):
            db.add(
                PropertyImage(
                    property_id=property_.id,
                    url=image,
                    alt_text=property_.name,
                    sort_order=index,
                    is_cover=index == 0,
                )
            )
        for code, name, description, modifier, sleeps, inventory in rooms:
            room_type = RoomType(property_id=property_.id, code=code, name=name, description=description, base_price_modifier=modifier, sleeps=sleeps)
            db.add(room_type)
            db.flush()
            db.add(
                Room(
                    property_id=property_.id,
                    room_type_id=room_type.id,
                    room_number=code,
                    name=name,
                    capacity=sleeps,
                    base_price=float(property_.base_price) + modifier,
                    inventory_count=inventory,
                    images=property_.gallery,
                )
            )
        for author, role_label, rating, comment in reviews:
            db.add(
                Review(
                    property_id=property_.id,
                    user_id=guest.id,
                    author_name=author,
                    role_label=role_label,
                    rating=rating,
                    comment=comment,
                    verified_booking=True,
                )
            )
    db.commit()
