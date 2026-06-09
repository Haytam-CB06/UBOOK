from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import now_utc
from app.models import Favorite, FavoriteType, Property, User
from app.services.serialization import property_to_frontend

router = APIRouter(prefix="/favorites", tags=["favorites"])


@router.get("")
def list_favorites(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favorites = db.query(Favorite).filter(Favorite.user_id == user.id, Favorite.deleted_at.is_(None)).all()
    property_ids = [item.target_id for item in favorites if item.favorite_type == FavoriteType.property]
    properties = db.query(Property).filter(Property.id.in_(property_ids), Property.deleted_at.is_(None)).all() if property_ids else []
    return [property_to_frontend(property_) for property_ in properties]


@router.post("/{favorite_type}/{target_id}", status_code=status.HTTP_201_CREATED)
def add_favorite(favorite_type: FavoriteType, target_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if favorite_type == FavoriteType.property and not db.get(Property, target_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.favorite_type == favorite_type, Favorite.target_id == target_id)
        .first()
    )
    if existing:
        if existing.deleted_at is not None:
            existing.deleted_at = None
            db.commit()
        return {"ok": True}
    db.add(Favorite(user_id=user.id, favorite_type=favorite_type, target_id=target_id))
    db.commit()
    return {"ok": True}


@router.delete("/{favorite_type}/{target_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(favorite_type: FavoriteType, target_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    favorite = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.favorite_type == favorite_type, Favorite.target_id == target_id, Favorite.deleted_at.is_(None))
        .first()
    )
    if not favorite:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found")
    favorite.deleted_at = now_utc()
    db.commit()

