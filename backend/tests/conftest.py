from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("UBOOK_ENVIRONMENT", "test")
test_db_path = Path(__file__).resolve().parents[1] / "test.db"
os.environ.setdefault("UBOOK_DATABASE_URL", f"sqlite:///{test_db_path.as_posix()}")
os.environ.setdefault("UBOOK_SECRET_KEY", "test-secret-key-with-enough-entropy-for-jwt-signing")
os.environ.setdefault("UBOOK_REFRESH_SECRET_KEY", "test-refresh-secret-key-with-enough-entropy")
os.environ.setdefault("UBOOK_RATE_LIMIT_REQUESTS", "10000")
os.environ["UBOOK_CORS_ORIGINS"] = "http://localhost:5173,http://127.0.0.1:5173"
os.environ["UBOOK_FRONTEND_URL"] = "http://localhost:5173"
os.environ["UBOOK_OAUTH_JAVASCRIPT_ORIGINS"] = "http://localhost:5173/,http://127.0.0.1:5173"

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient

from app.core.database import Base, SessionLocal, engine
from app.core.cache import cache
from app.main import app
from app.seed import seed_database


@pytest.fixture(autouse=True)
def clean_database():
    cache.delete_prefix("2fa:attempts:")
    cache.delete_prefix("jwt:blacklist:")
    cache.delete_prefix("rate:")
    cache.delete_prefix("search:")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield
    cache.delete_prefix("2fa:attempts:")
    cache.delete_prefix("jwt:blacklist:")
    cache.delete_prefix("rate:")
    cache.delete_prefix("search:")


@pytest.fixture
def client():
    return TestClient(app)


def auth_headers(client: TestClient, email: str = "admin@ubook.ma", password: str = "AdminPass123!") -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}
