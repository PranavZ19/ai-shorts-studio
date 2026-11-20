from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# Ensure storage directory exists before creating engine
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)

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
        needed_cols_sv = [
            ("audio_codec", "VARCHAR(50)"),
            ("aspect_ratio", "VARCHAR(20)"),
            ("has_audio", "BOOLEAN DEFAULT 1"),
            ("channel_name", "VARCHAR(255)")
        ]
        for col_name, col_type in needed_cols_sv:
            if col_name not in existing_cols:
                try:
                    conn.execute(text(f"ALTER TABLE source_videos ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass

        # Check transcripts columns
        res = conn.execute(text("PRAGMA table_info(transcripts)"))
        existing_trans = [row[1] for row in res.fetchall()]
        needed_trans = [
            ("language_probability", "FLOAT DEFAULT 1.0"),
            ("model_name", "VARCHAR(50) DEFAULT 'base'"),
            ("device_used", "VARCHAR(20) DEFAULT 'cuda'"),
            ("is_edited", "BOOLEAN DEFAULT 0"),
            ("updated_at", "DATETIME")
        ]
        for col_name, col_type in needed_trans:
            if col_name not in existing_trans:
                try:
                    conn.execute(text(f"ALTER TABLE transcripts ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass

        # Check transcript_segments columns
        res = conn.execute(text("PRAGMA table_info(transcript_segments)"))
        existing_segs = [row[1] for row in res.fetchall()]
        needed_segs = [
            ("original_text", "TEXT"),
            ("is_edited", "BOOLEAN DEFAULT 0")
        ]
        for col_name, col_type in needed_segs:
            if col_name not in existing_segs:
                try:
                    conn.execute(text(f"ALTER TABLE transcript_segments ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass

        # Check clips columns
        res = conn.execute(text("PRAGMA table_info(clips)"))
        existing_clips = [row[1] for row in res.fetchall()]
        needed_clips = [
            ("video_id", "VARCHAR(36)"),
            ("main_topic", "VARCHAR(255)"),
            ("hook_summary", "TEXT"),
            ("target_audience", "VARCHAR(255)"),
            ("analysis_mode", "VARCHAR(50) DEFAULT 'ollama_llm'"),
            ("ending_score", "FLOAT DEFAULT 0.0"),
            ("clarity_score", "FLOAT DEFAULT 0.0"),
            ("description", "TEXT"),
            ("tags", "VARCHAR(512)"),
            ("is_favorite", "BOOLEAN DEFAULT 0"),
            ("vtt_path", "VARCHAR(1024)"),
            ("resolution", "VARCHAR(50) DEFAULT '1080x1920'"),
            ("aspect_ratio", "VARCHAR(20) DEFAULT '9:16'")
        ]
        for col_name, col_type in needed_clips:
            if col_name not in existing_clips:
                try:
                    conn.execute(text(f"ALTER TABLE clips ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
                except Exception:
                    pass

        # Check post_performances columns
        try:
            res = conn.execute(text("PRAGMA table_info(post_performances)"))
            existing_perf = [row[1] for row in res.fetchall()]
            if "channel_profile_id" not in existing_perf and len(existing_perf) > 0:
                conn.execute(text("ALTER TABLE post_performances ADD COLUMN channel_profile_id VARCHAR(36)"))
                conn.commit()
        except Exception:
            pass

        # Check channel_profiles brand columns
        try:
            res = conn.execute(text("PRAGMA table_info(channel_profiles)"))
            existing_prof = [row[1] for row in res.fetchall()]
            needed_prof = [
                ("brand_voice", "VARCHAR(50) DEFAULT 'Conversational'"),
                ("content_language", "VARCHAR(50) DEFAULT 'English'"),
                ("target_audience_level", "VARCHAR(50) DEFAULT 'General audience'"),
                ("default_cta", "VARCHAR(200) DEFAULT 'Subscribe for more'"),
                ("creator_name", "VARCHAR(100)"),
                ("creator_bio", "TEXT"),
                ("creator_links_json", "TEXT DEFAULT '[]'")
            ]
            for col_name, col_type in needed_prof:
                if col_name not in existing_prof and len(existing_prof) > 0:
                    conn.execute(text(f"ALTER TABLE channel_profiles ADD COLUMN {col_name} {col_type}"))
                    conn.commit()
        except Exception:
            pass
