from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# SQLite connection with foreign keys enabled & WAL mode
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_migrations():
    """Ensure any newly added columns exist in the SQLite database."""
    with engine.connect() as conn:
        # Check source_videos columns
        res = conn.execute(text("PRAGMA table_info(source_videos)"))
        existing_cols = [row[1] for row in res.fetchall()]
        
        needed_cols = [
            ("audio_codec", "VARCHAR(50)"),
            ("aspect_ratio", "VARCHAR(20)"),
            ("has_audio", "BOOLEAN DEFAULT 1"),
            ("channel_name", "VARCHAR(255)")
        ]
        for col_name, col_type in needed_cols:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE source_videos ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass
