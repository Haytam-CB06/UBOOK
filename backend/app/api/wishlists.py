from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.security import now_utc
from app.models import Property, User, Wishlist, WishlistItem
from app.schemas.platform import WishlistCreate, WishlistItemCreate
from app.services.serialization import property_to_frontend

router = APIRouter(prefix="/wishlists", tags=["wishlists"])


@router.get("")
def list_wishlists(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wishlists = db.query(Wishlist).filter(Wishlist.user_id == user.id, Wishlist.deleted_at.is_(None)).order_by(Wishlist.created_at.desc()).all()
    return [_wishlist_payload(item) for item in wishlists]


@router.post("", status_code=status.HTTP_201_CREATED)
def create_wishlist(payload: WishlistCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wishlist = Wishlist(user_id=user.id, name=payload.name, description=payload.description)
    db.add(wishlist)
    db.commit()
    db.refresh(wishlist)
    return _wishlist_payload(wishlist)


@router.delete("/{wishlist_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist(wishlist_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wishlist = _get_owned_wishlist(db, wishlist_id, user)
    wishlist.deleted_at = now_utc()
    db.commit()


@router.post("/{wishlist_id}/items", status_code=status.HTTP_201_CREATED)
def add_item(wishlist_id: int, payload: WishlistItemCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wishlist = _get_owned_wishlist(db, wishlist_id, user)
    property_ = db.get(Property, payload.property_id)
    if not property_ or property_.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    existing = (
        db.query(WishlistItem)
        .filter(WishlistItem.wishlist_id == wishlist.id, WishlistItem.property_id == property_.id)
        .first()
    )
    if existing:
        existing.deleted_at = None
        db.commit()
        db.refresh(wishlist)
        return _wishlist_payload(wishlist)
    db.add(WishlistItem(wishlist_id=wishlist.id, property_id=property_.id))
    db.commit()
    db.refresh(wishlist)
    return _wishlist_payload(wishlist)


@router.delete("/{wishlist_id}/items/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(wishlist_id: int, property_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    wishlist = _get_owned_wishlist(db, wishlist_id, user)
    item = (
        db.query(WishlistItem)
        .filter(WishlistItem.wishlist_id == wishlist.id, WishlistItem.property_id == property_id, WishlistItem.deleted_at.is_(None))
        .first()
    )
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found")
    item.deleted_at = now_utc()
    db.commit()


def _get_owned_wishlist(db: Session, wishlist_id: int, user: User) -> Wishlist:
    wishlist = db.get(Wishlist, wishlist_id)
    if not wishlist or wishlist.deleted_at or wishlist.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist not found")
    return wishlist


def _wishlist_payload(wishlist: Wishlist) -> dict:
    items = [item for item in wishlist.items if item.deleted_at is None]
    return {
        "id": wishlist.id,
        "name": wishlist.name,
        "description": wishlist.description,
        "properties": [property_to_frontend(item.property) for item in items if item.property.deleted_at is None],
        "createdAt": wishlist.created_at.isoformat(),
    }
