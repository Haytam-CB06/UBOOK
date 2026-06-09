from __future__ import annotations

from conftest import auth_headers


def test_search_property_pricing_and_availability(client):
    response = client.get("/api/properties", params={"destination": "Marrakech", "guests": 2, "maxPrice": 250})
    assert response.status_code == 200, response.text
    data = response.json()
    assert data
    assert data[0]["name"]
    assert data[0]["roomOptions"]

    property_id = data[0]["id"]
    availability = client.post(
        f"/api/properties/{property_id}/availability",
        json={"checkIn": "2026-06-12", "checkOut": "2026-06-15", "guests": 2},
    )
    assert availability.status_code == 200
    assert availability.json()["available"] is True

    pricing = client.post(f"/api/properties/{property_id}/pricing", json={"nights": 3, "guests": 2})
    assert pricing.status_code == 200
    assert pricing.json()["total"] > pricing.json()["subtotal"]
    assert pricing.json()["breakdown"]


def test_booking_prevents_double_booking_when_inventory_exhausted(client):
    guest_headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    owner_headers = auth_headers(client, "owner@ubook.ma", "OwnerPass123!")
    payload = {
        "propertyId": 2,
        "fullName": "Amina El Mansouri",
        "email": "amina@ubook.ma",
        "guests": 8,
        "checkIn": "2026-07-01",
        "checkOut": "2026-07-05",
    }
    first = client.post("/api/bookings", json=payload, headers=guest_headers)
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "Pending"
    accepted = client.patch(f"/api/host/reservations/{first.json()['id']}/confirm", headers=owner_headers)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["statusRaw"] == "confirmed"

    second = client.post("/api/bookings", json=payload, headers=guest_headers)
    assert second.status_code == 409


def test_host_acceptance_blocks_only_that_property_calendar(client):
    guest_headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    owner_headers = auth_headers(client, "owner@ubook.ma", "OwnerPass123!")
    payload = {
        "propertyId": 2,
        "fullName": "Amina El Mansouri",
        "email": "guest@ubook.ma",
        "guests": 8,
        "checkIn": "2026-07-10",
        "checkOut": "2026-07-13",
    }
    created = client.post("/api/reservations", json=payload, headers=guest_headers)
    assert created.status_code == 201, created.text
    assert created.json()["statusRaw"] == "pending"

    host_reservations = client.get("/api/host/reservations", headers=owner_headers)
    assert host_reservations.status_code == 200, host_reservations.text
    assert any(item["id"] == created.json()["id"] for item in host_reservations.json())

    before_accept = client.get(
        "/api/properties/2/reservations/calendar",
        params={"start": "2026-07-10", "end": "2026-07-12"},
    )
    assert before_accept.status_code == 200, before_accept.text
    assert before_accept.json()[0]["available"] is True

    accepted = client.patch(f"/api/host/reservations/{created.json()['id']}/confirm", headers=owner_headers)
    assert accepted.status_code == 200, accepted.text
    assert accepted.json()["statusRaw"] == "confirmed"

    calendar = client.get(
        "/api/properties/2/reservations/calendar",
        params={"start": "2026-07-10", "end": "2026-07-12"},
    )
    assert calendar.status_code == 200, calendar.text
    assert calendar.json()[0]["available"] is False
    assert calendar.json()[0]["status"] == "reserved"

    availability = client.get(
        "/api/properties/2/availability",
        params={"check_in": "2026-07-10", "check_out": "2026-07-13", "guests": 8},
    )
    assert availability.status_code == 200, availability.text
    assert availability.json()["available"] is False


def test_booking_state_machine_and_admin_stats(client):
    headers = auth_headers(client)
    create = client.post(
        "/api/bookings",
        json={
            "propertyId": 1,
            "fullName": "Amina El Mansouri",
            "email": "amina@ubook.ma",
            "guests": 2,
            "checkIn": "2026-08-01",
            "checkOut": "2026-08-03",
        },
        headers=headers,
    )
    assert create.status_code == 201, create.text
    booking_id = create.json()["id"]

    confirmed = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "confirmed"}, headers=headers)
    assert confirmed.status_code == 200, confirmed.text
    checked_in = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "checked_in"}, headers=headers)
    assert checked_in.status_code == 200, checked_in.text
    illegal = client.patch(f"/api/bookings/{booking_id}/status", json={"status": "pending"}, headers=headers)
    assert illegal.status_code == 409

    stats = client.get("/api/admin/stats", headers=headers)
    assert stats.status_code == 200
    assert stats.json()["metrics"]
