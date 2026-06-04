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
    payload = {
        "propertyId": 2,
        "fullName": "Amina El Mansouri",
        "email": "amina@ubook.ma",
        "guests": 8,
        "checkIn": "2026-07-01",
        "checkOut": "2026-07-05",
    }
    first = client.post("/api/bookings", json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "Pending"

    second = client.post("/api/bookings", json=payload)
    assert second.status_code == 409


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
