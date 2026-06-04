from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import now_utc
from app.models import SavedSearch, User
from app.schemas.platform import SavedSearchCreate
from app.services.audit_service import audit

router = APIRouter(prefix="/saved-searches", tags=["saved-searches"])


@router.get("")
def list_saved_searches(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(SavedSearch).filter(SavedSearch.user_id == user.id, SavedSearch.deleted_at.is_(None)).order_by(SavedSearch.created_at.desc()).all()
    return [_payload(row) for row in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_saved_search(payload: SavedSearchCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = (
        db.query(SavedSearch)
        .filter(SavedSearch.user_id == user.id, SavedSearch.name == payload.name, SavedSearch.deleted_at.is_(None))
        .first()
    )
    if existing:
        existing.query = payload.query
        existing.alert_enabled = payload.alert_enabled
        db.commit()
        db.refresh(existing)
        return _payload(existing)
    row = SavedSearch(user_id=user.id, name=payload.name, query=payload.query, alert_enabled=payload.alert_enabled)
    db.add(row)
    audit(db, action="saved_search.created", actor=user, entity_type="saved_search", entity_id="pending")
    db.commit()
    db.refresh(row)
    return _payload(row)


@router.delete("/{saved_search_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_saved_search(saved_search_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.get(SavedSearch, saved_search_id)
    if not row or row.deleted_at or row.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved search not found")
    row.deleted_at = now_utc()
    audit(db, action="saved_search.deleted", actor=user, entity_type="saved_search", entity_id=row.id)
    db.commit()


def _payload(row: SavedSearch) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "query": row.query,
        "alertEnabled": row.alert_enabled,
        "createdAt": row.created_at.isoformat(),
        "updatedAt": row.updated_at.isoformat(),
    }
