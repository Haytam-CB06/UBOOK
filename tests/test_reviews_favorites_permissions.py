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
