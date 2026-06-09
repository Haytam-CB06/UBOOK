from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import Property
from app.services.serialization import property_to_frontend

router = APIRouter(prefix="/travel-finder", tags=["travel-finder"])


@router.post("/search")
def search(payload: dict, db: Session = Depends(get_db)):
    query_text = str(payload.get("query") or payload.get("destination") or "").strip()
    guests = int(payload.get("guests") or 1)
    query = db.query(Property).filter(Property.deleted_at.is_(None), Property.is_active.is_(True))
    if query_text:
        like = f"%{query_text.lower()}%"
        query = query.filter(
            or_(
                Property.city.ilike(like),
                Property.country.ilike(like),
                Property.location.ilike(like),
                Property.neighborhood.ilike(like),
                Property.search_vector.ilike(like),
            )
        )
    query = query.filter(Property.capacity >= guests).order_by(Property.average_rating.desc(), Property.review_count.desc())
    results = [property_to_frontend(property_) for property_ in query.limit(12).all()]
    return {"results": results, "total": len(results), "filters": payload.get("filters") or []}


@router.post("/chat")
def chat(payload: dict, db: Session = Depends(get_db)):
    message = str(payload.get("message") or "").strip()
    destination = message or payload.get("departureCountry") or ""
    search_payload = search({"query": destination, "guests": 1}, db)
    return {
        "message": "I found stays that match the travel context you provided.",
        "suggestions": search_payload["results"][:5],
    }


@router.post("/compare")
def compare(payload: dict, db: Session = Depends(get_db)):
    ids = [int(value) for value in payload.get("destinationIds") or [] if str(value).isdigit()]
    properties = db.query(Property).filter(Property.id.in_(ids), Property.deleted_at.is_(None)).all() if ids else []
    destinations = [property_to_frontend(property_) for property_ in properties]
    recommendation = destinations[0]["title"] if destinations else None
    return {"destinations": destinations, "recommendation": recommendation}
