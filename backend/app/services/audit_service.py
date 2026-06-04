from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import AuditLog, User


def audit(
    db: Session,
    *,
    action: str,
    actor: User | None = None,
    entity_type: str | None = None,
    entity_id: str | int | None = None,
    ip_address: str | None = None,
    metadata: dict | None = None,
) -> None:
    db.add(
        AuditLog(
            actor_id=actor.id if actor else None,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            ip_address=ip_address,
            metadata_json=metadata or {},
        )
    )

