import os
import sys
import json
import subprocess
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent.resolve()
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.project import Project
from app.models.source_video import SourceVideo

client = TestClient(app)

def run_phase2_tests():
    print("=" * 60)
    print("       STARTING PHASE 2 COMPREHENSIVE TEST SUITE")
    print("=" * 60)

    # 1. Create a Project
    print("\n[Step 1] Creating Test Project...")
    proj_res = client.post("/api/projects/", json={"name": "Phase 2 Validation Project", "description": "Automated Test Suite"})
    assert proj_res.status_code == 200, f"Failed to create project: {proj_res.text}"
    project = proj_res.json()
    project_id = project["id"]
    print(f"  -> Project created with ID: {project_id}")

    # 2. Generate a 3-second real test video using FFmpeg
    temp_dir = settings.TEMP_DIR
    temp_dir.mkdir(parents=True, exist_ok=True)
    sample_video_path = temp_dir / "sample_real_video.mp4"
    if sample_video_path.exists():
        sample_video_path.unlink()

    print("\n[Step 2] Generating real synthetic 3-second test video with FFmpeg...")
    cmd = [
        settings.FFMPEG_BIN, "-y",
        "-f", "lavfi", "-i", "testsrc=duration=3:size=1280x720:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=3",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        str(sample_video_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
    assert res.returncode == 0, f"FFmpeg failed to generate test video: {res.stderr}"
    assert sample_video_path.exists() and sample_video_path.stat().st_size > 0
    file_size = sample_video_path.stat().st_size
    print(f"  -> Sample video generated: {sample_video_path} ({file_size} bytes)")

    # 3. Test Invalid File Types
    print("\n[Step 3] Testing Invalid File Format Rejection...")
    invalid_file = temp_dir / "invalid_doc.txt"
    invalid_file.write_text("This is not a video file.")
    with open(invalid_file, "rb") as f:
        inv_res = client.post(
            "/api/videos/upload/direct",
            data={"project_id": project_id},
            files={"file": ("invalid_doc.txt", f, "text/plain")}
        )
    assert inv_res.status_code == 400, f"Expected 400 for invalid format, got: {inv_res.status_code}"
    print(f"  -> Correctly rejected invalid file: {inv_res.json().get('detail')}")

    # 4. Test Chunked Upload
    print("\n[Step 4] Testing Reliable Chunked Upload with Progress...")
    chunk_size = 50 * 1024  # 50KB chunks to test multi-chunk assembly
    total_chunks = (file_size + chunk_size - 1) // chunk_size

    # Init chunked upload
    init_res = client.post("/api/videos/upload/init", json={
        "project_id": project_id,
        "filename": "sample_chunked_video.mp4",
        "total_size": file_size,
        "total_chunks": total_chunks
    })
    assert init_res.status_code == 200, f"Chunk init failed: {init_res.text}"
    upload_id = init_res.json()["upload_id"]
    print(f"  -> Upload initialized with upload_id: {upload_id}, total chunks: {total_chunks}")

    # Send chunks sequentially
    with open(sample_video_path, "rb") as vf:
        for idx in range(total_chunks):
            chunk_data = vf.read(chunk_size)
            chunk_res = client.post(
                "/api/videos/upload/chunk",
                data={"upload_id": upload_id, "chunk_index": idx},
                files={"file": (f"chunk_{idx}.part", chunk_data, "application/octet-stream")}
            )
            assert chunk_res.status_code == 200, f"Chunk {idx} upload failed: {chunk_res.text}"

    # Complete upload & assemble
    print("  -> All chunks sent. Completing upload and triggering FFprobe analysis...")
    complete_res = client.post("/api/videos/upload/complete", json={"upload_id": upload_id})
    assert complete_res.status_code == 200, f"Upload complete failed: {complete_res.text}"
    uploaded_video = complete_res.json()
    video_id = uploaded_video["id"]
    print(f"  -> Video successfully processed and registered! Video ID: {video_id}")

    # 5. Verify FFprobe Metadata
    print("\n[Step 5] Verifying Technical Metadata against FFprobe...")
    print(f"  - Duration: {uploaded_video['duration']}s (Expected ~3.0s)")
    print(f"  - Resolution: {uploaded_video['width']}x{uploaded_video['height']} (Expected 1280x720)")
    print(f"  - Aspect Ratio: {uploaded_video['aspect_ratio']} (Expected 16:9)")
    print(f"  - Framerate: {uploaded_video['fps']} fps (Expected 30.0)")
    print(f"  - Video Codec: {uploaded_video['codec']} (Expected h264)")
    print(f"  - Audio Codec: {uploaded_video['audio_codec']} (Expected aac)")
    print(f"  - Has Audio: {uploaded_video['has_audio']} (Expected True)")

    assert abs(uploaded_video["duration"] - 3.0) < 0.2
    assert uploaded_video["width"] == 1280
    assert uploaded_video["height"] == 720
    assert uploaded_video["aspect_ratio"] == "16:9"
    assert uploaded_video["fps"] == 30.0
    assert uploaded_video["codec"] == "h264"
    assert uploaded_video["audio_codec"] == "aac"
    assert uploaded_video["has_audio"] is True
    print("  -> FFprobe metadata verification: PASS")

    # 6. Verify Saved File & Thumbnail on D:\AI-Shorts-Studio
    print("\n[Step 6] Verifying Files on D: Storage...")
    saved_file = settings.SOURCE_VIDEOS_DIR / f"{video_id}.mp4"
    saved_thumb = settings.THUMBNAILS_DIR / f"{video_id}.jpg"
    assert saved_file.exists() and saved_file.stat().st_size == file_size, "Saved file missing or wrong size!"
    assert saved_thumb.exists() and saved_thumb.stat().st_size > 0, "Thumbnail missing or 0 bytes!"
    print(f"  -> Verified source file on D: {saved_file} ({saved_file.stat().st_size} bytes)")
    print(f"  -> Verified thumbnail on D: {saved_thumb} ({saved_thumb.stat().st_size} bytes)")

    # 7. Verify Video Preview Playback (HTTP GET)
    print("\n[Step 7] Verifying Video Preview Static Route...")
    preview_res = client.get(f"/media/source/{video_id}.mp4")
    assert preview_res.status_code in [200, 206], f"Preview stream failed with {preview_res.status_code}"
    assert len(preview_res.content) == file_size
    print(f"  -> Video stream response: HTTP {preview_res.status_code}, content length={len(preview_res.content)}")

    thumb_res = client.get(f"/media/thumbnails/{video_id}.jpg")
    assert thumb_res.status_code == 200, f"Thumbnail fetch failed with {thumb_res.status_code}"
    print(f"  -> Thumbnail response: HTTP 200, length={len(thumb_res.content)}")

    # 8. Verify SQLite Persistence Across Database Sessions
    print("\n[Step 8] Verifying SQLite Persistence...")
    db = SessionLocal()
    rec = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    assert rec is not None, "Video record missing in database!"
    assert rec.title == "sample_chunked_video.mp4"
    assert rec.duration_seconds > 2.8
    db.close()
    print("  -> SQLite record verification: PASS")

    # 9. Test YouTube URL Validation & Metadata Inspection
    print("\n[Step 9] Testing YouTube URL Validation and Metadata Inspection...")
    # Test invalid format
    bad_yt = client.post("/api/videos/youtube/inspect", json={"url": "https://notyoutube.com/watch?v=123"})
    assert bad_yt.status_code == 400
    print(f"  -> Rejected invalid YouTube domain: {bad_yt.json().get('detail')}")

    # Test real public URL (e.g. Google Cloud public short demo)
    real_yt_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    print(f"  -> Inspecting public YouTube URL: {real_yt_url} ...")
    yt_res = client.post("/api/videos/youtube/inspect", json={"url": real_yt_url})
    if yt_res.status_code == 200:
        yt_meta = yt_res.json()
        print("  -> Successfully retrieved YouTube metadata via yt-dlp:")
        print(f"     Title: {yt_meta.get('title')}")
        print(f"     Channel: {yt_meta.get('channel_name')}")
        print(f"     Duration: {yt_meta.get('duration_seconds')}s")
        print(f"     Thumbnail: {yt_meta.get('thumbnail_url')[:60]}...")
    else:
        print(f"  -> YouTube inspection returned: {yt_res.status_code} ({yt_res.text})")

    # 10. Test Deletion & Safe File Removal
    print("\n[Step 10] Testing Safe Video Deletion...")
    del_res = client.delete(f"/api/videos/{video_id}")
    assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
    assert not saved_file.exists(), "Source video file was not removed from disk!"
    assert not saved_thumb.exists(), "Thumbnail was not removed from disk!"

    db = SessionLocal()
    del_check = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
    assert del_check is None, "Video record still present in database after delete!"
    db.close()
    print("  -> Safe deletion verified: Source video, thumbnail, and database records removed cleanly.")

    # Clean up temp test video
    sample_video_path.unlink(missing_ok=True)
    invalid_file.unlink(missing_ok=True)

    print("\n" + "=" * 60)
    print("     ALL PHASE 2 TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 60)

if __name__ == "__main__":
    run_phase2_tests()
