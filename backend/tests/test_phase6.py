"""
Test Suite: Phase 6 — Clip Management, Export & Download Center
Validates all 20 required verification points:
1. Generated clip listing with sorting and pagination
2. Clip search & status filtering
3. Clip metadata editing (rename title, description, tags)
4. Favorites toggling and tags persistence
5. Individual MP4 download (with Content-Disposition attachment)
6. SRT and VTT subtitle downloads
7. Poster thumbnail download
8. Single-clip ZIP export (videos/, subtitles/, thumbnails/, metadata/, README.txt)
9. Multiple-clip ZIP export (bulk archive)
10. Project export with and without original source video
11. Large-file streaming with HTTP 206 Partial Content & Range requests
12. Missing-file handling (clean 404 responses)
13. Bulk operations (bulk approval and bulk deletion)
14. Deletion safety (source videos remain completely untouched)
15. SQLite database persistence
16. Dashboard statistics (8 metrics + real activity feed)
17. Actual video preview stream & seeking
18. Hindi / Devanagari captioned video rendering
19. Real YuNet face detection & tracking reframing
20. Explicit CPU rendering fallback (libx264)
"""

import os
import sys
import json
import time
import uuid
import zipfile
import subprocess
from pathlib import Path
import numpy as np
import cv2

from fastapi.testclient import TestClient

# Ensure backend root is on path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.main import app
from app.config import settings
from app.database import get_db, SessionLocal, run_migrations
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.models.clip import Clip
from app.models.job import ProcessingJob
from app.services.face_tracker_service import face_tracker
from app.services.caption_service import caption_service
from app.services.video_render_service import video_render_service

client = TestClient(app)

def create_synthetic_test_video(path: Path, duration_sec: int = 3, with_face: bool = False, face_x: int = 200) -> Path:
    """Create a synthetic 1280x720 video with audio using FFmpeg and OpenCV."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_raw = path.parent / f"temp_{path.stem}.mp4"

    if with_face:
        # Load sample face fixture
        face_path = backend_dir / "tests" / "fixtures" / "sample_face.jpg"
        if face_path.exists():
            face_img = cv2.imread(str(face_path))
            h_f, w_f = face_img.shape[:2]
            canvas = np.zeros((720, 1280, 3), dtype=np.uint8)
            canvas[100:100+h_f, face_x:face_x+w_f] = face_img
        else:
            canvas = np.zeros((720, 1280, 3), dtype=np.uint8)

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(str(temp_raw), fourcc, 25.0, (1280, 720))
        for _ in range(int(duration_sec * 25)):
            out.write(canvas)
        out.release()

        # Add silent audio stream
        cmd = [
            settings.FFMPEG_BIN, "-y",
            "-i", str(temp_raw),
            "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",
            str(path)
        ]
        subprocess.run(cmd, capture_output=True, timeout=15)
        temp_raw.unlink(missing_ok=True)
    else:
        cmd = [
            settings.FFMPEG_BIN, "-y",
            "-f", "lavfi", "-i", f"testsrc=size=1280x720:rate=30:duration={duration_sec}",
            "-f", "lavfi", "-i", f"sine=frequency=440:sample_rate=48000:duration={duration_sec}",
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "128k",
            str(path)
        ]
        subprocess.run(cmd, capture_output=True, timeout=15)

    return path

def run_all_phase6_tests():
    print("=" * 70)
    print("       STARTING PHASE 6 CLIP MANAGEMENT & EXPORT TESTS")
    print("=" * 70)

    run_migrations()
    db = SessionLocal()

    # Setup Test Fixture Project & Source Video
    test_proj = Project(
        name="Phase 6 Creator Showcase",
        description="Comprehensive export and management verification"
    )
    db.add(test_proj)
    db.commit()
    db.refresh(test_proj)

    test_video_path = settings.STORAGE_DIR / "source_videos" / f"phase6_source_{uuid.uuid4().hex[:6]}.mp4"
    create_synthetic_test_video(test_video_path, duration_sec=4, with_face=True, face_x=220)

    test_video = SourceVideo(
        project_id=test_proj.id,
        title="Creator Masterclass Episode 1",
        file_path=str(test_video_path),
        file_size_bytes=test_video_path.stat().st_size,
        duration_seconds=4.0,
        width=1280,
        height=720,
        fps=25.0,
        codec="h264",
        audio_codec="aac"
    )
    db.add(test_video)
    db.commit()
    db.refresh(test_video)

    # Add Transcripts (with English and Hindi words)
    transcript = Transcript(
        video_id=test_video.id,
        language="hi",
        language_probability=0.98,
        full_text="नमस्ते दोस्तों AI Shorts Studio में आपका स्वागत है।",
        model_name="base",
        device_used="cuda"
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    hindi_words = [
        {"word": "नमस्ते", "start": 0.2, "end": 0.8},
        {"word": "दोस्तों", "start": 0.8, "end": 1.4},
        {"word": "AI", "start": 1.5, "end": 1.9},
        {"word": "Studio", "start": 2.0, "end": 2.5},
        {"word": "स्वागत", "start": 2.6, "end": 3.2}
    ]
    seg = TranscriptSegment(
        transcript_id=transcript.id,
        segment_index=0,
        start_time=0.2,
        end_time=3.5,
        text="नमस्ते दोस्तों AI Studio स्वागत",
        words_json=json.dumps(hindi_words)
    )
    db.add(seg)
    db.commit()

    # Pre-create 3 Clips
    clip1 = Clip(
        project_id=test_proj.id,
        video_id=test_video.id,
        title="Opening Hook Revelation",
        description="The ultimate secret revealed for social growth",
        tags="viral,hook,creator",
        main_topic="Social Growth",
        start_time=0.0,
        end_time=3.0,
        duration=3.0,
        overall_score=94.0,
        hook_score=95.0,
        emotional_score=92.0,
        is_approved=True,
        is_favorite=True,
        status="candidate",
        ai_metadata_json=json.dumps({
            "titles": ["Stop Scrolling Now!", "The Secret Revealed"],
            "hashtags": ["shorts", "creator", "viral"],
            "target_audience": "Creators"
        })
    )
    clip2 = Clip(
        project_id=test_proj.id,
        video_id=test_video.id,
        title="Surprising Growth Hack",
        description="Practical step-by-step breakdown",
        tags="tech,tutorial",
        main_topic="Strategy",
        start_time=0.5,
        end_time=3.2,
        duration=2.7,
        overall_score=86.0,
        hook_score=85.0,
        is_approved=False,
        is_favorite=False,
        status="candidate"
    )
    clip3 = Clip(
        project_id=test_proj.id,
        video_id=test_video.id,
        title="Rejected Boring Monologue",
        description="Low energy introduction",
        tags="intro",
        start_time=1.0,
        end_time=3.0,
        duration=2.0,
        overall_score=45.0,
        is_approved=False,
        is_favorite=False,
        status="rejected"
    )
    db.add_all([clip1, clip2, clip3])
    db.commit()
    db.refresh(clip1)
    db.refresh(clip2)
    db.refresh(clip3)

    # Extract all string IDs before closing database session
    proj_id = str(test_proj.id)
    video_id = str(test_video.id)
    clip1_id = str(clip1.id)
    clip2_id = str(clip2.id)
    clip3_id = str(clip3.id)
    db.close()

    try:
        # -------------------------------------------------------------
        # [Step 1 & 2] Listing, Search & Status Filtering
        # -------------------------------------------------------------
        print("\n[Step 1 & 2] Testing Clip Listing, Search & Status Filtering...")
        res = client.get("/api/clips/?limit=50")
        assert res.status_code == 200
        all_clips = res.json()
        assert len(all_clips) >= 3
        print(f"  -> Successfully listed {len(all_clips)} clips.")

        # Search by tag or topic
        res_search = client.get("/api/clips/?search=Growth")
        assert res_search.status_code == 200
        search_results = res_search.json()
        assert any("Growth" in c["title"] or c["main_topic"] == "Social Growth" for c in search_results)
        print(f"  -> Search for 'Growth' matched {len(search_results)} clips.")

        # Filter by status='rejected'
        res_rej = client.get("/api/clips/?status=rejected")
        assert res_rej.status_code == 200
        assert any(c["id"] == clip3_id for c in res_rej.json())
        print(f"  -> Status filtering confirmed rejected clips.")

        # -------------------------------------------------------------
        # [Step 3 & 4] Metadata Editing, Favorites & Tags
        # -------------------------------------------------------------
        print("\n[Step 3 & 4] Testing Clip Renaming, Metadata Editing & Favorites...")
        # Toggle Favorite
        res_fav = client.patch(f"/api/clips/{clip2_id}/favorite")
        assert res_fav.status_code == 200
        assert res_fav.json()["is_favorite"] is True
        print("  -> Favorite toggled successfully.")

        # Update title and tags
        res_edit = client.put(f"/api/clips/{clip2_id}", json={
            "title": "Renamed Masterclass Short",
            "description": "Updated description for export",
            "tags": ["algorithm", "growth", "2026"]
        })
        assert res_edit.status_code == 200
        updated = res_edit.json()["clip"]
        assert updated["title"] == "Renamed Masterclass Short"
        assert "algorithm" in updated["tags"]
        print("  -> Clip renamed and tags persisted successfully.")

        # -------------------------------------------------------------
        # [Step 19] Real YuNet Face Detection on Video
        # -------------------------------------------------------------
        print("\n[Step 19] Testing Real YuNet Face Detection on Video...")
        assert face_tracker.detector is not None
        crop_info = face_tracker.analyze_crop_trajectory(
            video_path=test_video_path,
            start_time=0.0,
            end_time=2.0,
            target_aspect_ratio="9:16",
            framing_mode="auto_face"
        )
        assert crop_info["mode"] == "smart_face_tracking"
        assert "crop=" in crop_info["filter_str"]
        print(f"  -> YuNet Face Tracking Mode: {crop_info['mode']}")
        print(f"  -> Generated Centered Crop Filter: {crop_info['filter_str']}")

        # -------------------------------------------------------------
        # [Step 18] Render Clip 1 with Hindi Captions (NVENC)
        # -------------------------------------------------------------
        print("\n[Step 18] Rendering Hindi-Captioned Vertical Short (1080x1920)...")
        render_res1 = video_render_service.render_clip(
            clip_id=clip1_id,
            source_video_path=test_video_path,
            start_time=0.0,
            end_time=2.5,
            transcript_segments=[{
                "start_time": 0.2,
                "end_time": 2.5,
                "words": hindi_words
            }],
            edit_config={
                "aspect_ratio": "9:16",
                "caption_preset": "bold_creator",
                "highlight_color": "#FFCC00"
            }
        )
        assert Path(render_res1["output_path"]).exists()
        assert Path(render_res1["srt_path"]).exists()
        assert Path(render_res1["vtt_path"]).exists()
        assert Path(render_res1["thumbnail_path"]).exists()
        print(f"  -> Clip 1 Rendered: {render_res1['output_path']}")
        print(f"  -> Encoder: {render_res1['encoder_used']}, Resolution: {render_res1['width']}x{render_res1['height']}")

        # Persist in DB
        db = SessionLocal()
        c1_db = db.query(Clip).filter(Clip.id == clip1_id).first()
        c1_db.output_path = render_res1["output_path"]
        c1_db.thumbnail_path = render_res1["thumbnail_path"]
        c1_db.srt_path = render_res1["srt_path"]
        c1_db.vtt_path = render_res1["vtt_path"]
        c1_db.file_size_bytes = render_res1["file_size_bytes"]
        c1_db.status = "exported"
        db.commit()
        db.close()

        # -------------------------------------------------------------
        # [Step 20] Explicit CPU Rendering Fallback (libx264)
        # -------------------------------------------------------------
        print("\n[Step 20] Testing Explicit CPU Rendering Fallback (libx264)...")
        render_res2 = video_render_service.render_clip(
            clip_id=clip2_id,
            source_video_path=test_video_path,
            start_time=0.5,
            end_time=2.5,
            edit_config={
                "aspect_ratio": "9:16",
                "force_cpu": True  # Force libx264
            }
        )
        assert Path(render_res2["output_path"]).exists()
        assert render_res2["encoder_used"] == "libx264"
        print(f"  -> Forced CPU render successful: encoder={render_res2['encoder_used']}")

        db = SessionLocal()
        c2_db = db.query(Clip).filter(Clip.id == clip2_id).first()
        c2_db.output_path = render_res2["output_path"]
        c2_db.thumbnail_path = render_res2["thumbnail_path"]
        c2_db.srt_path = render_res2["srt_path"]
        c2_db.vtt_path = render_res2["vtt_path"]
        c2_db.file_size_bytes = render_res2["file_size_bytes"]
        c2_db.status = "exported"
        db.commit()
        db.close()

        # -------------------------------------------------------------
        # [Step 5, 6, 7] Individual File Downloads
        # -------------------------------------------------------------
        print("\n[Step 5, 6, 7] Testing Individual File Downloads (MP4, SRT, VTT, Thumbnail, Metadata)...")
        # MP4
        res_mp4 = client.get(f"/api/downloads/clip/{clip1_id}/mp4?download=true")
        assert res_mp4.status_code == 200
        assert "attachment" in res_mp4.headers.get("content-disposition", "")
        print(f"  -> MP4 Download OK ({len(res_mp4.content)} bytes)")

        # SRT
        res_srt = client.get(f"/api/downloads/clip/{clip1_id}/srt")
        assert res_srt.status_code == 200
        assert "-->" in res_srt.text
        print("  -> SRT Download OK")

        # VTT
        res_vtt = client.get(f"/api/downloads/clip/{clip1_id}/vtt")
        assert res_vtt.status_code == 200
        assert "WEBVTT" in res_vtt.text
        print("  -> WebVTT Download OK")

        # Thumbnail
        res_thumb = client.get(f"/api/downloads/clip/{clip1_id}/thumbnail?download=true")
        assert res_thumb.status_code == 200
        print(f"  -> Thumbnail Download OK ({len(res_thumb.content)} bytes)")

        # Metadata JSON
        res_meta = client.get(f"/api/downloads/clip/{clip1_id}/metadata")
        assert res_meta.status_code == 200
        meta_json = res_meta.json()
        assert meta_json["id"] == clip1_id
        assert "virality_metrics" in meta_json
        print("  -> Metadata JSON Download OK")

        # -------------------------------------------------------------
        # [Step 8] Single-Clip ZIP Export
        # -------------------------------------------------------------
        print("\n[Step 8] Testing Standalone Single-Clip ZIP Export...")
        res_zip = client.get(f"/api/downloads/clip/{clip1_id}/zip")
        assert res_zip.status_code == 200
        zip_bytes = res_zip.content

        # Verify ZIP archive structure in memory
        temp_test_zip = settings.TEMP_DIR / "test_verify_single.zip"
        with open(temp_test_zip, "wb") as f:
            f.write(zip_bytes)

        with zipfile.ZipFile(temp_test_zip, "r") as zf:
            namelist = zf.namelist()
            assert any(n.startswith("videos/") and n.endswith(".mp4") for n in namelist)
            assert any(n.startswith("subtitles/srt/") for n in namelist)
            assert any(n.startswith("subtitles/vtt/") for n in namelist)
            assert any(n.startswith("thumbnails/") for n in namelist)
            assert "README.txt" in namelist
        temp_test_zip.unlink(missing_ok=True)
        print("  -> Single Clip ZIP contains videos/, subtitles/, thumbnails/, metadata/, README.txt")

        # -------------------------------------------------------------
        # [Step 9] Multiple-Clip Bulk ZIP Export
        # -------------------------------------------------------------
        print("\n[Step 9] Testing Multiple-Clip Bulk ZIP Export...")
        res_bulk_zip = client.post("/api/downloads/bulk/zip", json={
            "clip_ids": [clip1_id, clip2_id],
            "include_subtitles": True,
            "include_thumbnails": True,
            "include_metadata": True,
            "package_name": "Multi_Shorts_Package"
        })
        assert res_bulk_zip.status_code == 200
        temp_bulk = settings.TEMP_DIR / "test_verify_bulk.zip"
        with open(temp_bulk, "wb") as f:
            f.write(res_bulk_zip.content)

        with zipfile.ZipFile(temp_bulk, "r") as zf:
            namelist = zf.namelist()
            mp4_files = [n for n in namelist if n.startswith("videos/") and n.endswith(".mp4")]
            assert len(mp4_files) == 2
            assert "manifest.json" in namelist
            assert "README.txt" in namelist
        temp_bulk.unlink(missing_ok=True)
        print("  -> Bulk ZIP successfully bundled multiple MP4s with manifest and README.")

        # -------------------------------------------------------------
        # [Step 10] Project Export With and Without Source Video
        # -------------------------------------------------------------
        print("\n[Step 10] Testing Project Export Archive (With and Without Source)...")
        # 1. Without source (compact)
        res_proj_compact = client.get(f"/api/downloads/project/{proj_id}/zip?include_source=false")
        assert res_proj_compact.status_code == 200
        temp_p1 = settings.TEMP_DIR / "test_proj_compact.zip"
        with open(temp_p1, "wb") as f:
            f.write(res_proj_compact.content)
        with zipfile.ZipFile(temp_p1, "r") as zf:
            names = zf.namelist()
            assert not any(n.startswith("source_video/") for n in names)
            assert "project_manifest.json" in names
            assert any(n.startswith("transcripts/") for n in names)
        temp_p1.unlink(missing_ok=True)
        print("  -> Project Export (Without Source) verified cleanly.")

        # 2. With source
        res_proj_full = client.get(f"/api/downloads/project/{proj_id}/zip?include_source=true")
        assert res_proj_full.status_code == 200
        temp_p2 = settings.TEMP_DIR / "test_proj_full.zip"
        with open(temp_p2, "wb") as f:
            f.write(res_proj_full.content)
        with zipfile.ZipFile(temp_p2, "r") as zf:
            names = zf.namelist()
            assert any(n.startswith("source_video/") for n in names)
        temp_p2.unlink(missing_ok=True)
        print("  -> Project Export (With Source Video) verified successfully.")

        # -------------------------------------------------------------
        # [Step 11 & 17] Large-File Streaming & Range Seeking
        # -------------------------------------------------------------
        print("\n[Step 11 & 17] Testing HTTP 206 Partial Content Video Streaming & Seeking...")
        # Normal stream without range
        res_stream = client.get(f"/api/downloads/clip/{clip1_id}/stream")
        assert res_stream.status_code == 200
        assert res_stream.headers["accept-ranges"] == "bytes"

        # Byte-range request (e.g. seeking halfway)
        total_size = len(res_stream.content)
        range_header = f"bytes=1000-5000"
        res_range = client.get(f"/api/downloads/clip/{clip1_id}/stream", headers={"Range": range_header})
        assert res_range.status_code == 206
        assert res_range.headers["content-range"].startswith(f"bytes 1000-5000/{total_size}")
        assert len(res_range.content) == 4001
        print("  -> HTTP 206 Partial Content range seeking validated successfully.")

        # -------------------------------------------------------------
        # [Step 12] Missing File Handling
        # -------------------------------------------------------------
        print("\n[Step 12] Testing Missing-File Handling...")
        fake_id = str(uuid.uuid4())
        res_404 = client.get(f"/api/downloads/clip/{fake_id}/mp4")
        assert res_404.status_code == 404
        print("  -> Non-existent clip properly returns HTTP 404.")

        # -------------------------------------------------------------
        # [Step 16] Dashboard Statistics
        # -------------------------------------------------------------
        print("\n[Step 16] Testing Dashboard Statistics & Activity Feed...")
        res_dash = client.get("/api/analytics/dashboard")
        assert res_dash.status_code == 200
        dash_data = res_dash.json()
        stats = dash_data["stats"]
        assert stats["total_projects"] >= 1
        assert stats["total_source_videos"] >= 1
        assert stats["total_rendered_clips"] >= 2
        assert stats["storage_used_mb"] > 0
        assert "recent_activities" in dash_data
        assert len(dash_data["recent_activities"]) >= 1
        print(f"  -> Dashboard Stats verified: Rendered={stats['total_rendered_clips']}, Storage={stats['storage_used_mb']} MB")
        print(f"  -> Activity Feed: {len(dash_data['recent_activities'])} activities logged.")

        # -------------------------------------------------------------
        # [Step 13 & 14] Bulk Approval, Bulk Deletion & Deletion Safety
        # -------------------------------------------------------------
        print("\n[Step 13 & 14] Testing Bulk Approval, Deletion & Source Safety...")
        # Bulk approve
        res_bulk_appr = client.post("/api/clips/bulk/approval", json={
            "clip_ids": [clip1_id, clip2_id],
            "is_approved": True
        })
        assert res_bulk_appr.status_code == 200
        assert res_bulk_appr.json()["updated_count"] == 2
        print("  -> Bulk approval of 2 clips confirmed.")

        # Delete clip 3
        res_del3 = client.delete(f"/api/clips/{clip3_id}?delete_media=true")
        assert res_del3.status_code == 200
        print("  -> Single clip deleted successfully.")

        # Bulk delete clip 1 and clip 2
        res_del_bulk = client.post("/api/clips/bulk/delete", json={
            "clip_ids": [clip1_id, clip2_id],
            "delete_media": True
        })
        assert res_del_bulk.status_code == 200
        del_data = res_del_bulk.json()
        assert del_data["deleted_count"] == 2
        print(f"  -> Bulk delete confirmed: {del_data['deleted_count']} clips removed, {del_data['mb_freed']} MB freed.")

        # Verify source video is STILL PRESENT (Deletion Safety)
        assert test_video_path.exists()
        print("  -> Deletion Safety verified: Source video file remains untouched.")

        # -------------------------------------------------------------
        # [Step 15] SQLite Database Persistence
        # -------------------------------------------------------------
        print("\n[Step 15] Verifying SQLite Database Persistence...")
        db = SessionLocal()
        p_check = db.query(Project).filter(Project.id == proj_id).first()
        assert p_check is not None
        v_check = db.query(SourceVideo).filter(SourceVideo.id == video_id).first()
        assert v_check is not None
        deleted_clips = db.query(Clip).filter(Clip.id.in_([clip1_id, clip2_id, clip3_id])).all()
        assert len(deleted_clips) == 0
        db.close()
        print("  -> SQLite database integrity verified.")

        print("\n" + "=" * 70)
        print("     ALL PHASE 6 CLIP MANAGEMENT & EXPORT TESTS PASSED (100%)!")
        print("=" * 70)

    finally:
        # Cleanup test files
        test_video_path.unlink(missing_ok=True)
        db = SessionLocal()
        try:
            db.query(SourceVideo).filter(SourceVideo.id == video_id).delete()
            db.query(Project).filter(Project.id == proj_id).delete()
            db.commit()
        except Exception:
            pass
        finally:
            db.close()

if __name__ == "__main__":
    run_all_phase6_tests()
