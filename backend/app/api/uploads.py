from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.api.deps import get_current_user
from app.models import User
from app.services.storage_service import storage

router = APIRouter(prefix="/uploads", tags=["uploads"])


@router.post("/images", status_code=status.HTTP_201_CREATED)
def upload_image(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        url = storage.save(file, prefix=f"user-{user.id}")
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    return {"url": url}

