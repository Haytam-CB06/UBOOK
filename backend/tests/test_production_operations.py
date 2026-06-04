from __future__ import annotations

from conftest import auth_headers


def test_saved_searches_preferences_and_calendar_management(client):
    guest_headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")
    owner_headers = auth_headers(client, "owner@ubook.ma", "OwnerPass123!")

    saved = client.post(
        "/api/saved-searches",
        json={"name": "Marrakech weekend", "query": {"destination": "Marrakech", "guests": 2}, "alertEnabled": True},
        headers=guest_headers,
    )
    assert saved.status_code == 201, saved.text
    listed = client.get("/api/saved-searches", headers=guest_headers)
    assert listed.status_code == 200
    assert listed.json()[0]["query"]["destination"] == "Marrakech"

    preferences = client.get("/api/profiles/me/preferences", headers=guest_headers)
    assert preferences.status_code == 200, preferences.text
    updated = client.put("/api/profiles/me/preferences/notifications", json={"marketing": True}, headers=guest_headers)
    assert updated.status_code == 200
    assert updated.json()["marketing"] is True

    owned_properties = client.get("/api/host/properties", headers=owner_headers)
    assert owned_properties.status_code == 200, owned_properties.text
    property_id = owned_properties.json()[0]["id"]
    calendar = client.put(
        f"/api/properties/{property_id}/calendar",
        json={"rows": [{"calendarDate": "2026-09-10", "availableUnits": 0, "minNights": 2, "closed": True, "priceOverride": 199}]},
        headers=owner_headers,
    )
    assert calendar.status_code == 200, calendar.text
    row = calendar.json()[0]
    assert row["closed"] is True
    assert row["priceOverride"] == 199


def test_payment_confirmation_support_reports_disputes_and_read_receipts(client):
    guest_headers = auth_headers(client, "guest@ubook.ma", "GuestPass123!")

    booking = client.post(
        "/api/bookings",
        json={
            "propertyId": 1,
            "fullName": "Guest User",
            "email": "guest@ubook.ma",
            "guests": 2,
            "checkIn": "2026-10-01",
            "checkOut": "2026-10-04",
        },
        headers=guest_headers,
    )
    assert booking.status_code == 201, booking.text
    assert booking.json()["status"] == "Pending"

    payment = client.post("/api/payments", json={"bookingId": booking.json()["id"], "provider": "manual"}, headers=guest_headers)
    assert payment.status_code == 201, payment.text
    confirmed = client.post(
        f"/api/payments/{payment.json()['id']}/confirm",
        json={"status": "succeeded", "transactionId": "manual-test-001"},
        headers=guest_headers,
    )
    assert confirmed.status_code == 200, confirmed.text
    refreshed_booking = client.get(f"/api/bookings/{booking.json()['id']}", headers=guest_headers)
    assert refreshed_booking.json()["status"] == "Confirmed"

    support = client.post("/api/support", json={"subject": "Arrival help", "body": "I need arrival support."}, headers=guest_headers)
    assert support.status_code == 201, support.text
    report = client.post("/api/reports", json={"targetType": "property", "targetId": 1, "reason": "Incorrect amenity"}, headers=guest_headers)
    assert report.status_code == 201, report.text
    dispute = client.post("/api/disputes", json={"bookingId": booking.json()["id"], "reason": "Billing mismatch"}, headers=guest_headers)
    assert dispute.status_code == 201, dispute.text

    conversation = client.post("/api/messages/conversations", json={"propertyId": 1, "hostId": 2}, headers=guest_headers)
    assert conversation.status_code == 201, conversation.text
    message = client.post(f"/api/messages/conversations/{conversation.json()['id']}/messages", json={"body": "Hello"}, headers=guest_headers)
    assert message.status_code == 201, message.text
    read = client.post(f"/api/messages/conversations/{conversation.json()['id']}/read", headers=guest_headers)
    assert read.status_code == 200
    assert "updated" in read.json()
