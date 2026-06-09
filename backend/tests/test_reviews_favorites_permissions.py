from __future__ import annotations

from conftest import auth_headers


def test_favorites_require_auth_and_round_trip(client):
    assert client.get("/api/favorites").status_code == 401
    headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    added = client.post("/api/favorites/property/1", headers=headers)
    assert added.status_code == 201
    favorites = client.get("/api/favorites", headers=headers)
    assert favorites.status_code == 200
    assert favorites.json()[0]["id"] == 1
    removed = client.delete("/api/favorites/property/1", headers=headers)
    assert removed.status_code == 204


def test_owner_can_create_property_room_and_guest_cannot(client):
    owner_headers = auth_headers(client, "owner@ubook.ma", "OwnerPass123!")
    guest_headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    payload = {
        "name": "Essaouira Blue House",
        "type": "House",
        "city": "Essaouira",
        "location": "Medina walls",
        "neighborhood": "Medina",
        "latitude": 31.5085,
        "longitude": -9.7595,
        "price": 144,
        "capacity": 4,
        "description": "A verified house inside Essaouira medina.",
        "image": "/images/ubook/property-house.png",
        "gallery": ["/images/ubook/property-house.png"],
        "amenities": ["Sea view"],
        "tags": ["Coastal"],
        "host": "Blue House Hosts",
        "verified": True,
        "dynamicPricingNote": "Weekend coastal demand adjusts pricing.",
    }
    forbidden = client.post("/api/properties", json=payload, headers=guest_headers)
    assert forbidden.status_code == 403
    created = client.post("/api/properties", json=payload, headers=owner_headers)
    assert created.status_code == 201, created.text
    availability = client.get(
        f"/api/properties/{created.json()['id']}/availability",
        params={"check_in": "2026-11-01", "check_out": "2026-11-04", "guests": 4},
    )
    assert availability.status_code == 200, availability.text
    assert availability.json()["available"] is True
    room = client.post(
        "/api/rooms",
        json={
            "propertyId": created.json()["id"],
            "roomNumber": "blue-1",
            "name": "Blue Suite",
            "capacity": 4,
            "basePrice": 144,
            "inventoryCount": 1,
            "amenities": ["Sea view"],
        },
        headers=owner_headers,
    )
    assert room.status_code == 201, room.text


def test_guest_reviews_completed_stay_and_public_host_profile(client):
    guest_headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    owner_headers = auth_headers(client, "owner@ubook.ma", "OwnerPass123!")
    payload = {
        "propertyId": 2,
        "fullName": "Guest User",
        "email": "guest@ubook.ma",
        "guests": 2,
        "checkIn": "2026-12-01",
        "checkOut": "2026-12-04",
    }
    booking = client.post("/api/reservations", json=payload, headers=guest_headers)
    assert booking.status_code == 201, booking.text

    confirmed = client.patch(f"/api/host/reservations/{booking.json()['id']}/confirm", headers=owner_headers)
    assert confirmed.status_code == 200, confirmed.text
    completed = client.patch(f"/api/host/reservations/{booking.json()['id']}/complete", headers=owner_headers)
    assert completed.status_code == 200, completed.text
    assert completed.json()["statusRaw"] == "completed"

    stay_review = client.post(
        "/api/reviews/stay",
        json={
            "propertyId": 2,
            "bookingId": booking.json()["id"],
            "hostId": completed.json()["hostId"],
            "apartmentRating": 5,
            "apartmentComment": "Apartment was clean, accurate, and easy to access.",
            "hostRating": 5,
            "hostComment": "The host answered quickly and handled arrival clearly.",
        },
        headers=guest_headers,
    )
    assert stay_review.status_code == 201, stay_review.text
    assert stay_review.json()["propertyReview"]["rating"] == 5
    assert stay_review.json()["hostReview"]["rating"] == 5

    duplicate = client.post(
        "/api/reviews/stay",
        json={
            "propertyId": 2,
            "bookingId": booking.json()["id"],
            "hostId": completed.json()["hostId"],
            "apartmentRating": 4,
            "apartmentComment": "Trying a second apartment review.",
            "hostRating": 4,
            "hostComment": "Trying a second host review.",
        },
        headers=guest_headers,
    )
    assert duplicate.status_code == 409

    profile = client.get(f"/api/profiles/hosts/{completed.json()['hostId']}")
    assert profile.status_code == 200, profile.text
    assert profile.json()["properties"]
    assert profile.json()["hostReviews"]
    assert len(profile.json()["allReviews"]) >= 2
    assert any(review["propertyId"] == 2 for review in profile.json()["propertyReviews"])
