import os
import json
import shutil
import sqlite3
import zipfile
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.database import engine, run_migrations
from app.models.project import Project
from app.models.clip import Clip
from app.models.source_video import SourceVideo
from app.models.strategy import ChannelProfile, ScheduledPost, ContentIdea
from app.models.publishing_kit import PublishingKit
from app.models.settings import StudioSetting

logger = logging.getLogger(__name__)

class BackupService:
    def __init__(self, db: Session):
        self.db = db
        self.backups_dir = settings.EXPORTS_DIR / "backups"
        self.backups_dir.mkdir(parents=True, exist_ok=True)

    def create_backup(self, include_media: bool = False, notes: Optional[str] = None) -> Dict[str, Any]:
        """Creates a timestamped backup archive of database, metadata, and optional media."""
        timestamp_str = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"backup_ai_shorts_studio_{timestamp_str}.zip"
        backup_path = self.backups_dir / backup_filename

        # Force SQLite WAL checkpoint to ensure database file on disk is 100% up-to-date
        try:
            self.db.commit()
            with engine.connect() as conn:
                conn.exec_driver_sql("PRAGMA wal_checkpoint(TRUNCATE);")
        except Exception as e:
            logger.warning(f"WAL checkpoint warning: {e}")

        # Gather summary metadata
        project_count = self.db.query(Project).count()
        video_count = self.db.query(SourceVideo).count()
        clip_count = self.db.query(Clip).count()
        kit_count = self.db.query(PublishingKit).count()
        profile_count = self.db.query(ChannelProfile).count()
        scheduled_count = self.db.query(ScheduledPost).count()

        manifest = {
            "app_name": settings.APP_NAME,
            "app_version": settings.APP_VERSION,
            "backup_version": "1.0",
            "created_at": datetime.utcnow().isoformat(),
            "include_media": include_media,
            "notes": notes or "Automated Studio Backup",
            "stats": {
                "projects": project_count,
                "source_videos": video_count,
                "clips": clip_count,
                "publishing_kits": kit_count,
                "channel_profiles": profile_count,
                "scheduled_posts": scheduled_count
            }
        }

        # Build ZIP archive
        with zipfile.ZipFile(backup_path, "w", zipfile.ZIP_DEFLATED) as zf:
            # 1. Manifest
            zf.writestr("manifest.json", json.dumps(manifest, indent=2))

            # 2. SQLite Database File (safely read)
            db_path = settings.DATABASE_PATH
            if db_path.exists():
                zf.write(db_path, arcname="studio.db")

            # 3. Optional media (source videos, clips, thumbnails)
            if include_media:
                # Add source videos
                for v in self.db.query(SourceVideo).all():
                    if v.file_path and Path(v.file_path).exists():
                        zf.write(v.file_path, arcname=f"media/source_videos/{Path(v.file_path).name}")

                # Add clips
                for c in self.db.query(Clip).all():
                    if c.output_path and Path(c.output_path).exists():
                        zf.write(c.output_path, arcname=f"media/clips/{Path(c.output_path).name}")
                    if c.srt_path and Path(c.srt_path).exists():
                        zf.write(c.srt_path, arcname=f"media/clips/{Path(c.srt_path).name}")

                # Add thumbnails
                for t in settings.THUMBNAILS_DIR.glob("*.jpg"):
                    if t.exists():
                        zf.write(t, arcname=f"media/thumbnails/{t.name}")

            # 4. Readme instructions
            readme_text = (
                f"AI SHORTS STUDIO — BACKUP ARCHIVE\n"
                f"Created: {manifest['created_at']}\n"
                f"Projects: {project_count} | Clips: {clip_count} | Kits: {kit_count}\n"
                f"Includes Media: {include_media}\n\n"
                f"To restore this backup, use the Studio Settings > Backup & Restore interface.\n"
            )
            zf.writestr("README.txt", readme_text)

        file_size = backup_path.stat().st_size
        return {
            "success": True,
            "filename": backup_filename,
            "filepath": str(backup_path),
            "file_size_bytes": file_size,
            "created_at": manifest["created_at"],
            "include_media": include_media,
            "manifest": manifest
        }

    def list_backups(self) -> List[Dict[str, Any]]:
        """Lists available backup archives sorted by date descending."""
        results = []
        for p in self.backups_dir.glob("backup_*.zip"):
            try:
                stat = p.stat()
                manifest = None
                with zipfile.ZipFile(p, "r") as zf:
                    if "manifest.json" in zf.namelist():
                        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))

                results.append({
                    "filename": p.name,
                    "filepath": str(p),
                    "file_size_bytes": stat.st_size,
                    "created_at": manifest["created_at"] if manifest else datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "include_media": manifest.get("include_media", False) if manifest else False,
                    "stats": manifest.get("stats", {}) if manifest else {},
                    "notes": manifest.get("notes", "") if manifest else ""
                })
            except Exception as e:
                logger.warning(f"Error inspecting backup file {p.name}: {e}")
                results.append({
                    "filename": p.name,
                    "filepath": str(p),
                    "file_size_bytes": p.stat().st_size,
                    "created_at": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                    "include_media": False,
                    "stats": {},
                    "notes": "Corrupted or non-standard backup"
                })

        results.sort(key=lambda x: x["created_at"], reverse=True)
        return results

    def validate_backup(self, filename: str) -> Dict[str, Any]:
        """Validates backup archive structure and database integrity before restoration."""
        backup_path = self.backups_dir / filename
        if not backup_path.exists():
            return {"valid": False, "error": "Backup file not found on disk"}

        try:
            with zipfile.ZipFile(backup_path, "r") as zf:
                namelist = zf.namelist()
                if "manifest.json" not in namelist:
                    return {"valid": False, "error": "Missing manifest.json in archive"}
                if "studio.db" not in namelist:
                    return {"valid": False, "error": "Missing studio.db in archive"}

                manifest = json.loads(zf.read("manifest.json").decode("utf-8"))

                # Test database integrity by extracting to temp folder and checking
                temp_db_extract = settings.TEMP_DIR / f"validate_{filename[:8]}_studio.db"
                with zf.open("studio.db") as src, open(temp_db_extract, "wb") as dst:
                    shutil.copyfileobj(src, dst)

                conn = sqlite3.connect(str(temp_db_extract))
                cursor = conn.cursor()
                cursor.execute("PRAGMA integrity_check;")
                check_result = cursor.fetchone()
                conn.close()
                temp_db_extract.unlink(missing_ok=True)

                if not check_result or check_result[0] != "ok":
                    return {"valid": False, "error": f"Database integrity check failed: {check_result}"}

                return {
                    "valid": True,
                    "filename": filename,
                    "created_at": manifest.get("created_at"),
                    "stats": manifest.get("stats", {}),
                    "include_media": manifest.get("include_media", False),
                    "app_version": manifest.get("app_version")
                }
        except Exception as e:
            return {"valid": False, "error": f"Invalid or corrupt zip archive: {e}"}

    def restore_backup(self, filename: str) -> Dict[str, Any]:
        """Restores studio database and media from a validated backup archive."""
        validation = self.validate_backup(filename)
        if not validation.get("valid"):
            raise ValueError(validation.get("error", "Validation failed"))

        backup_path = self.backups_dir / filename

        # 1. Create a safety snapshot of current database
        current_db = settings.DATABASE_PATH
        safety_bak = None
        if current_db.exists():
            safety_bak = settings.STORAGE_DIR / f"studio.db.pre_restore_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.bak"
            shutil.copy2(current_db, safety_bak)

        # 2. Extract database and media from ZIP
        try:
            self.db.commit()
            self.db.close()
        except Exception:
            pass

        # Dispose engine pool so no open handles lock the SQLite file or WAL on Windows
        try:
            engine.dispose()
        except Exception:
            pass

        # Remove stale WAL and SHM files to ensure restored studio.db is read cleanly
        wal_file = Path(f"{current_db}-wal")
        shm_file = Path(f"{current_db}-shm")
        wal_file.unlink(missing_ok=True)
        shm_file.unlink(missing_ok=True)

        with zipfile.ZipFile(backup_path, "r") as zf:
            # Overwrite studio.db
            with zf.open("studio.db") as src, open(current_db, "wb") as dst:
                shutil.copyfileobj(src, dst)

            # Extract any media folders if present
            namelist = zf.namelist()
            for item in namelist:
                if item.startswith("media/source_videos/"):
                    target = settings.SOURCE_VIDEOS_DIR / Path(item).name
                    with zf.open(item) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                elif item.startswith("media/clips/"):
                    target = settings.CLIPS_DIR / Path(item).name
                    with zf.open(item) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)
                elif item.startswith("media/thumbnails/"):
                    target = settings.THUMBNAILS_DIR / Path(item).name
                    with zf.open(item) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)

        # 3. Run migrations on restored database to ensure columns are up-to-date
        run_migrations()

        return {
            "success": True,
            "filename": filename,
            "restored_at": datetime.utcnow().isoformat(),
            "stats": validation.get("stats", {}),
            "pre_restore_backup": str(safety_bak) if safety_bak else "",
            "message": "Studio data was restored successfully."
        }
