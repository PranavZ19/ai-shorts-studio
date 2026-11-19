import os
import shutil
import uuid
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from app.config import settings
from app.services.video_analysis_service import video_analysis_service

class UploadService:
    def __init__(self):
        self.upload_sessions_dir = settings.TEMP_DIR / "upload_chunks"
        self.upload_sessions_dir.mkdir(parents=True, exist_ok=True)

    def init_chunked_upload(self, project_id: str, filename: str, total_size: int, total_chunks: int) -> Dict[str, Any]:
        """Initialize a new chunked upload session."""
        is_valid, msg = video_analysis_service.validate_file_format(filename)
        if not is_valid:
            raise ValueError(msg)

        if total_size <= 0:
            raise ValueError("File size must be greater than zero bytes")

        upload_id = str(uuid.uuid4())
        session_dir = self.upload_sessions_dir / upload_id
        session_dir.mkdir(parents=True, exist_ok=True)

        meta_file = session_dir / "meta.json"
        import json
        with open(meta_file, "w", encoding="utf-8") as f:
            json.dump({
                "upload_id": upload_id,
                "project_id": project_id,
                "filename": filename,
                "total_size": total_size,
                "total_chunks": total_chunks,
                "received_chunks": []
            }, f)

        return {
            "upload_id": upload_id,
            "filename": filename,
            "total_chunks": total_chunks
        }

    def save_chunk(self, upload_id: str, chunk_index: int, chunk_bytes: bytes) -> Dict[str, Any]:
        """Save a single chunk to the upload session directory."""
        session_dir = self.upload_sessions_dir / upload_id
        if not session_dir.exists():
            raise FileNotFoundError("Upload session expired or invalid. Please re-initiate upload.")

        chunk_file = session_dir / f"chunk_{chunk_index:05d}.part"
        with open(chunk_file, "wb") as f:
            f.write(chunk_bytes)

        # Update metadata
        meta_file = session_dir / "meta.json"
        import json
        if meta_file.exists():
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            if chunk_index not in meta["received_chunks"]:
                meta["received_chunks"].append(chunk_index)
            with open(meta_file, "w", encoding="utf-8") as f:
                json.dump(meta, f)

            return {
                "upload_id": upload_id,
                "chunk_index": chunk_index,
                "received_count": len(meta["received_chunks"]),
                "total_chunks": meta["total_chunks"]
            }

        return {"upload_id": upload_id, "chunk_index": chunk_index}

    def finalize_chunked_upload(self, upload_id: str) -> Tuple[Path, str, str]:
        """Assemble all chunks sequentially into the final video file under storage/source_videos."""
        session_dir = self.upload_sessions_dir / upload_id
        if not session_dir.exists():
            raise FileNotFoundError("Upload session does not exist")

        meta_file = session_dir / "meta.json"
        import json
        if not meta_file.exists():
            raise ValueError("Upload session metadata corrupted")

        with open(meta_file, "r", encoding="utf-8") as f:
            meta = json.load(f)

        project_id = meta["project_id"]
        filename = meta["filename"]
        total_chunks = meta["total_chunks"]
        total_size = meta["total_size"]
        ext = Path(filename).suffix.lower()

        video_id = str(uuid.uuid4())
        dest_filename = f"{video_id}{ext}"
        final_video_path = settings.SOURCE_VIDEOS_DIR / dest_filename

        # Stream chunks directly into destination file to avoid memory bloat
        assembled_size = 0
        with open(final_video_path, "wb") as outfile:
            for i in range(total_chunks):
                chunk_file = session_dir / f"chunk_{i:05d}.part"
                if not chunk_file.exists():
                    final_video_path.unlink(missing_ok=True)
                    raise ValueError(f"Missing chunk {i} of {total_chunks}. Upload is incomplete.")
                with open(chunk_file, "rb") as cf:
                    while True:
                        block = cf.read(1024 * 1024)
                        if not block:
                            break
                        outfile.write(block)
                        assembled_size += len(block)

        # Clean session directory
        try:
            shutil.rmtree(session_dir)
        except Exception:
            pass

        return final_video_path, filename, project_id

upload_service = UploadService()
