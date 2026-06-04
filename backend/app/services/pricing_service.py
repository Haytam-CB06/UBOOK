from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from pymongo import MongoClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Property


def _mongo_rules(property_id: int) -> dict[str, Any]:
    try:
        client = MongoClient(settings.mongodb_url, serverSelectionTimeoutMS=250)
        db = client[settings.mongodb_database]
        return db.pricing_rules.find_one({"property_id": property_id}) or {}
    except Exception:
        return {}


def _nights(check_in: date | None, check_out: date | None, nights: int | None) -> int:
    if check_in and check_out:
        return max(1, (check_out - check_in).days)
    return nights or 1


def calculate_price(
    db: Session,
    *,
    property_: Property,
    check_in: date | None = None,
    check_out: date | None = None,
    nights: int | None = None,
    guests: int = 1,
) -> dict:
    night_count = _nights(check_in, check_out, nights)
    base_price = float(property_.price_per_night if property_.price_per_night is not None else property_.base_price)
    rules = _mongo_rules(property_.id)
    current = check_in or date.today()

    subtotal = 0.0
    breakdown: list[dict[str, float | str]] = []
    occupancy_count = len([booking for booking in property_.bookings if booking.deleted_at is None])

    for index in range(night_count):
        day = current + timedelta(days=index)
        multiplier = 1.0
        reasons: list[str] = []

        season_rules = rules.get("seasonal_pricing", [])
        for rule in season_rules:
            if rule.get("start") <= day.isoformat() <= rule.get("end"):
                multiplier *= float(rule.get("multiplier", 1))
                reasons.append("season")

        if day.weekday() >= 4:
            multiplier *= float(rules.get("weekend_multiplier", 1))
            reasons.append("weekend")

        holidays = set(rules.get("holidays", []))
        if day.isoformat() in holidays:
            multiplier *= float(rules.get("holiday_multiplier", 1))
            reasons.append("holiday")

        if "occupancy_threshold" in rules and occupancy_count >= int(rules["occupancy_threshold"]):
            multiplier *= float(rules.get("occupancy_multiplier", 1))
            reasons.append("occupancy")

        if "last_minute_days" in rules and (day - date.today()).days <= int(rules["last_minute_days"]):
            multiplier *= float(rules.get("last_minute_multiplier", 1))
            reasons.append("last_minute")

        nightly = round(base_price * multiplier, 2)
        subtotal += nightly
        breakdown.append({"date": day.isoformat(), "base": base_price, "multiplier": round(multiplier, 3), "nightly": nightly, "reason": ",".join(reasons) or "base"})

    discount = 0.0
    if "long_stay_nights" in rules and night_count >= int(rules["long_stay_nights"]):
        discount_rate = float(rules.get("long_stay_discount", 0))
        discount = round(subtotal * discount_rate, 2)
        breakdown.append({"date": "discount", "base": subtotal, "multiplier": -discount_rate, "nightly": -discount, "reason": "long_stay"})

    subtotal = round(subtotal - discount, 2)
    cleaning_fee = round(float(property_.cleaning_fee), 2)
    configured_service_fee = float(property_.service_fee)
    service_fee_rate = float(rules.get("service_fee_rate", 0))
    service_fee = round(configured_service_fee if configured_service_fee else subtotal * service_fee_rate, 2)
    taxes = rules.get("taxes", {})
    city_tax = round(guests * night_count * float(taxes.get("city_tax_per_guest_night", 0)), 2)
    total = round(subtotal + cleaning_fee + service_fee + city_tax, 2)

    return {
        "nightlyRate": round(subtotal / night_count, 2),
        "subtotal": subtotal,
        "cleaningFee": cleaning_fee,
        "serviceFee": service_fee,
        "cityTax": city_tax,
        "discounts": discount,
        "total": total,
        "currency": "USD",
        "breakdown": breakdown,
    }
