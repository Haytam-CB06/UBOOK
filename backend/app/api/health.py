from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.cache import cache
from app.core.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    cache.set("health:ping", "1", 5)
    return {"status": "ok", "database": "ok", "redis": "ok" if cache.get("health:ping") == "1" else "degraded"}
