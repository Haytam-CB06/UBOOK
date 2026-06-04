from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.cache import cache
from app.core.database import SessionLocal, get_db
from app.core.security import decode_token, now_utc
from app.messaging.manager import manager
from app.models import Conversation, Message, Notification, Property, Role, User
from app.schemas.platform import ConversationCreate, MessageCreate

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations")
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = db.query(Conversation).filter(Conversation.deleted_at.is_(None)).order_by(Conversation.last_message_at.desc().nullslast())
    if user.role not in {Role.admin, Role.super_admin}:
        query = query.filter((Conversation.traveler_id == user.id) | (Conversation.host_id == user.id))
    return [_conversation_payload(conversation, viewer=user) for conversation in query.all()]


@router.post("/conversations", status_code=status.HTTP_201_CREATED)
def create_conversation(payload: ConversationCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    property_ = db.get(Property, payload.property_id) if payload.property_id else None
    if payload.property_id and (not property_ or property_.deleted_at):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    host_id = property_.owner_id if property_ and property_.owner_id else payload.host_id
    traveler_id = user.id if user.role == Role.guest else payload.host_id
    if user.role == Role.hotel_admin:
        traveler_id = payload.host_id
        host_id = user.id
    conversation = (
        db.query(Conversation)
        .filter(Conversation.booking_id == payload.booking_id, Conversation.traveler_id == traveler_id, Conversation.host_id == host_id, Conversation.deleted_at.is_(None))
        .first()
    )
    if conversation:
        return _conversation_payload(conversation, viewer=user)
    conversation = Conversation(property_id=payload.property_id, booking_id=payload.booking_id, traveler_id=traveler_id, host_id=host_id)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return _conversation_payload(conversation, viewer=user)


@router.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _get_conversation(db, conversation_id, user)
    return _conversation_payload(conversation, include_messages=True, viewer=user)


@router.post("/conversations/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(conversation_id: int, payload: MessageCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _get_conversation(db, conversation_id, user)
    message = _create_message(db, conversation, user, payload)
    db.commit()
    db.refresh(message)
    data = _message_payload(message)
    await manager.broadcast(f"conversation:{conversation.id}", {"type": "message", "message": data})
    await manager.broadcast(f"user:{_recipient_id(conversation, user)}", {"type": "notification", "conversationId": conversation.id, "message": data})
    return data


@router.post("/conversations/{conversation_id}/read")
def mark_conversation_read(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversation = _get_conversation(db, conversation_id, user)
    timestamp = now_utc()
    updated = 0
    for message in conversation.messages:
        if message.deleted_at is None and message.sender_id != user.id and message.read_at is None:
            message.read_at = timestamp
            updated += 1
    db.commit()
    return {"ok": True, "updated": updated, "readAt": timestamp.isoformat()}


@router.websocket("/ws/conversations/{conversation_id}")
async def websocket_conversation(websocket: WebSocket, conversation_id: int, token: str = Query(...)):
    db = SessionLocal()
    user: User | None = None
    try:
        user = _websocket_user(db, token)
        conversation = _get_conversation(db, conversation_id, user)
        await manager.connect(f"conversation:{conversation.id}", websocket)
        while True:
            data = await websocket.receive_json()
            message = _create_message(db, conversation, user, MessageCreate(**data))
            db.commit()
            db.refresh(message)
            await manager.broadcast(f"conversation:{conversation.id}", {"type": "message", "message": _message_payload(message)})
    except WebSocketDisconnect:
        if user:
            manager.disconnect(f"conversation:{conversation_id}", websocket)
    except Exception:
        await websocket.close(code=1008)
    finally:
        db.close()


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket, token: str = Query(...)):
    db = SessionLocal()
    try:
        user = _websocket_user(db, token)
        await manager.connect(f"user:{user.id}", websocket)
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if "user" in locals():
            manager.disconnect(f"user:{user.id}", websocket)
    except Exception:
        await websocket.close(code=1008)
    finally:
        db.close()


def _websocket_user(db: Session, token: str) -> User:
    payload = decode_token(token, expected_type="access")
    if cache.is_blacklisted(payload["jti"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
    user = db.get(User, int(payload["sub"]))
    if not user or user.deleted_at or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User inactive")
    return user


def _get_conversation(db: Session, conversation_id: int, user: User) -> Conversation:
    conversation = db.get(Conversation, conversation_id)
    if not conversation or conversation.deleted_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if user.role not in {Role.admin, Role.super_admin} and user.id not in {conversation.traveler_id, conversation.host_id}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conversation access denied")
    return conversation


def _create_message(db: Session, conversation: Conversation, user: User, payload: MessageCreate) -> Message:
    if not payload.body and not payload.image_url:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Message body or imageUrl is required")
    message = Message(conversation_id=conversation.id, sender_id=user.id, body=payload.body, image_url=payload.image_url)
    conversation.last_message_at = now_utc()
    db.add(message)
    recipient = db.get(User, _recipient_id(conversation, user))
    if recipient:
        db.add(
            Notification(
                user_id=recipient.id,
                email=recipient.email,
                notification_type="new_message",
                subject=f"New message from {user.full_name}",
                body=payload.body or "Image message received.",
                delivered_at=now_utc(),
            )
        )
    return message


def _recipient_id(conversation: Conversation, user: User) -> int:
    return conversation.host_id if user.id == conversation.traveler_id else conversation.traveler_id


def _conversation_payload(conversation: Conversation, include_messages: bool = False, viewer: User | None = None) -> dict:
    messages = [message for message in conversation.messages if message.deleted_at is None]
    unread_count = len([message for message in messages if viewer and message.sender_id != viewer.id and message.read_at is None])
    payload = {
        "id": conversation.id,
        "propertyId": conversation.property_id,
        "bookingId": conversation.booking_id,
        "travelerId": conversation.traveler_id,
        "hostId": conversation.host_id,
        "travelerName": conversation.traveler.full_name if conversation.traveler else None,
        "hostName": conversation.host.full_name if conversation.host else None,
        "propertyTitle": conversation.property.title or conversation.property.name if conversation.property else None,
        "unreadCount": unread_count,
        "lastMessageAt": conversation.last_message_at.isoformat() if conversation.last_message_at else None,
        "createdAt": conversation.created_at.isoformat(),
    }
    if include_messages:
        payload["messages"] = [_message_payload(message) for message in messages]
    return payload


def _message_payload(message: Message) -> dict:
    return {
        "id": message.id,
        "conversationId": message.conversation_id,
        "senderId": message.sender_id,
        "body": message.body,
        "imageUrl": message.image_url,
        "readAt": message.read_at.isoformat() if message.read_at else None,
        "createdAt": message.created_at.isoformat(),
    }
