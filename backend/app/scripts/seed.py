from app.core.database import SessionLocal
from app.seed import seed_database


def main() -> None:
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()

