import os
import sys
import uuid
import json
import time
import subprocess
import numpy as np
import cv2
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.transcript import Transcript, TranscriptSegment
from app.models.clip import Clip
from app.services.face_tracker_service import FaceTrackerService
from app.services.caption_service import CaptionService
from app.services.video_render_service import VideoRenderService

client = TestClient(app)

def create_synthetic_video_with_face(
    output_path: Path,
    width: int = 1280,
    height: int = 720,
    duration: float = 3.0,
    fps: int = 30,
    draw_moving_face: bool = True
):
    """
    Generate an authentic video file with a synthesized face and audio track.
    If draw_moving_face=True, draws a moving realistic face schema that OpenCV YuNet/Haar can detect.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    temp_raw = output_path.parent / f"raw_{output_path.stem}.mp4"
    temp_wav = output_path.parent / f"tone_{output_path.stem}.wav"

    total_frames = int(duration * fps)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(str(temp_raw), fourcc, fps, (width, height))

    face_w, face_h = 100, 130
    for f in range(total_frames):
        # Background gradient
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        frame[:] = (30, 25, 20)

        if draw_moving_face:
            # Pan face horizontally across the middle third of the frame
            progress = f / max(1, total_frames - 1)
            cx = int(width * 0.35 + (width * 0.30 * progress))
            cy = height // 2

            # Draw natural skin-tone face oval
            cv2.ellipse(frame, (cx, cy), (face_w // 2, face_h // 2), 0, 0, 360, (180, 205, 240), -1)
            # Eyes
            eye_y = cy - 20
            cv2.circle(frame, (cx - 22, eye_y), 8, (60, 40, 30), -1)
            cv2.circle(frame, (cx + 22, eye_y), 8, (60, 40, 30), -1)
            # Nose
            cv2.line(frame, (cx, cy - 8), (cx, cy + 12), (130, 150, 190), 3)
            # Mouth
            cv2.ellipse(frame, (cx, cy + 32), (20, 8), 0, 0, 180, (70, 70, 180), 3)

        out.write(frame)
    out.release()

    # Generate synthetic 48kHz audio tone
    audio_cmd = [
        settings.FFMPEG_BIN, "-y",
        "-f", "lavfi", "-i", f"sine=frequency=440:duration={duration}",
        "-c:a", "pcm_s16le", "-ar", "48000",
        str(temp_wav)
    ]
    subprocess.run(audio_cmd, capture_output=True, timeout=10)

    # Mux video + audio into standard H.264 MP4
    mux_cmd = [
        settings.FFMPEG_BIN, "-y",
        "-i", str(temp_raw),
        "-i", str(temp_wav),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(output_path)
    ]
    subprocess.run(mux_cmd, capture_output=True, timeout=15)

    temp_raw.unlink(missing_ok=True)
    temp_wav.unlink(missing_ok=True)
    return output_path

def run_phase5_tests():
    print("=" * 70)
    print("       STARTING PHASE 5 AUTOMATIC VIDEO EDITING & RENDERING TESTS")
    print("=" * 70)

    # 1. Preset Check Endpoint
    print("\n[Step 1] Testing Caption Presets Endpoint (GET /api/clips/presets)...")
    preset_res = client.get("/api/clips/presets")
    assert preset_res.status_code == 200
    presets = preset_res.json()
    print(f"  -> Returned {len(presets)} caption presets:")
    for k, v in presets.items():
        print(f"     - {k}: {v['name']} ({v['highlight_color']})")
    assert "bold_creator" in presets
    assert "karaoke_highlight" in presets
    assert "clean_minimal" in presets
    assert "podcast_style" in presets
    assert "minimal_subtitle" in presets

    # 2. Test Face Tracking & Framing Logic
    print("\n[Step 2] Testing Face & Subject Tracking on 16:9 Landscape Video...")
    temp_landscape_video = settings.TEMP_DIR / "test_landscape_face.mp4"
    create_synthetic_video_with_face(temp_landscape_video, width=1280, height=720, duration=2.5, draw_moving_face=True)
    assert temp_landscape_video.exists()

    ft_service = FaceTrackerService()
    crop_result = ft_service.analyze_crop_trajectory(
        video_path=temp_landscape_video,
        start_time=0.0,
        end_time=2.5,
        target_aspect_ratio="9:16",
        framing_mode="auto_face"
    )
    print(f"  -> Face Tracking Crop Mode: {crop_result['mode']}")
    print(f"  -> Crop Filter: {crop_result['filter_str']}")
    assert crop_result["crop_w"] == int(720 * 9 / 16)  # 405px
    assert crop_result["crop_h"] == 720
    assert "crop=" in crop_result["filter_str"]

    # 3. Test Center Crop Fallback on video with no faces
    print("\n[Step 3] Testing Center Crop Fallback Mode (No Faces Present)...")
    temp_blank_video = settings.TEMP_DIR / "test_blank_noface.mp4"
    create_synthetic_video_with_face(temp_blank_video, width=1280, height=720, duration=2.0, draw_moving_face=False)
    
    blank_crop = ft_service.analyze_crop_trajectory(
        video_path=temp_blank_video,
        start_time=0.0,
        end_time=2.0,
        target_aspect_ratio="9:16",
        framing_mode="auto_face"
    )
    print(f"  -> Blank Video Fallback Mode: {blank_crop['mode']}")
    print(f"  -> Blank Crop Filter: {blank_crop['filter_str']}")
    assert blank_crop["mode"] == "center_fallback"
    assert blank_crop["crop_x"] == (1280 - blank_crop["crop_w"]) // 2

    # 4. Test Square (1:1) and Portrait (9:16) Reframing
    print("\n[Step 4] Testing 1:1 Square and 9:16 Portrait Input Handling...")
    square_crop = ft_service.analyze_crop_trajectory(
        video_path=temp_landscape_video,
        start_time=0.0,
        end_time=1.0,
        target_aspect_ratio="1:1",
        framing_mode="center"
    )
    assert square_crop["crop_w"] == 720
    assert square_crop["crop_h"] == 720
    print(f"  -> 1:1 Square Crop: {square_crop['filter_str']}")

    portrait_video = settings.TEMP_DIR / "test_portrait.mp4"
    create_synthetic_video_with_face(portrait_video, width=720, height=1280, duration=1.5, draw_moving_face=False)
    portrait_crop = ft_service.analyze_crop_trajectory(
        video_path=portrait_video,
        start_time=0.0,
        end_time=1.0,
        target_aspect_ratio="9:16",
        framing_mode="center"
    )
    print(f"  -> 9:16 Portrait Direct Fit: {portrait_crop['filter_str']}")
    assert portrait_crop["crop_w"] == 720
    assert portrait_crop["crop_h"] == 1280

    # 5. Test English Animated Captions Generation (ASS & SRT)
    print("\n[Step 5] Testing English Word-Highlighted Synchronized Caption Generation...")
    cap_service = CaptionService()
    english_words = [
        {"word": "Welcome", "start": 0.0, "end": 0.5},
        {"word": "to", "start": 0.5, "end": 0.7},
        {"word": "AI", "start": 0.7, "end": 1.1},
        {"word": "Shorts", "start": 1.1, "end": 1.6},
        {"word": "Studio.", "start": 1.6, "end": 2.2}
    ]
    test_ass_en = settings.TEMP_DIR / "test_caption_en.ass"
    test_srt_en = settings.TEMP_DIR / "test_caption_en.srt"

    cap_service.generate_ass_subtitle(english_words, test_ass_en, preset_name="bold_creator")
    cap_service.generate_srt_subtitle(english_words, test_srt_en)

    assert test_ass_en.exists() and test_ass_en.stat().st_size > 0
    assert test_srt_en.exists() and test_srt_en.stat().st_size > 0

    with open(test_ass_en, "r", encoding="utf-8") as f:
        ass_txt = f.read()
    assert "[Script Info]" in ass_txt
    assert "PlayResX: 1080" in ass_txt
    assert "PlayResY: 1920" in ass_txt
    assert "Dialogue:" in ass_txt
    print(f"  -> Generated English ASS Subtitle ({test_ass_en.stat().st_size} bytes)")
    print(f"  -> Sample ASS Dialogue: {ass_txt.splitlines()[-1]}")

    # 6. Test Hindi / Devanagari Caption Generation & Font Fallback
    print("\n[Step 6] Testing Hindi / Devanagari Unicode Caption Generation...")
    hindi_words = [
        {"word": "नमस्ते", "start": 0.0, "end": 0.6},
        {"word": "दोस्तों", "start": 0.6, "end": 1.2},
        {"word": "यह", "start": 1.2, "end": 1.5},
        {"word": "परीक्षण", "start": 1.5, "end": 2.0},
        {"word": "है।", "start": 2.0, "end": 2.5}
    ]
    test_ass_hi = settings.TEMP_DIR / "test_caption_hi.ass"
    cap_service.generate_ass_subtitle(hindi_words, test_ass_hi, preset_name="karaoke_highlight")

    assert test_ass_hi.exists()
    with open(test_ass_hi, "r", encoding="utf-8") as f:
        hi_ass_txt = f.read()
    assert "नमस्ते" in hi_ass_txt
    assert "परीक्षण" in hi_ass_txt
    assert "Nirmala UI" in hi_ass_txt  # Confirms Devanagari font fallback included
    print("  -> Devanagari glyphs and font fallback verified successfully in ASS output.")

    # 7. Test Video Rendering Engine with NVENC / CPU Fallback
    print("\n[Step 7] Testing Video Rendering Pipeline (NVENC Hardware Accelerated)...")
    render_service = VideoRenderService()
    test_clip_id = str(uuid.uuid4())
    mock_segments = [
        {
            "start_time": 0.0,
            "end_time": 2.5,
            "text": "Welcome to AI Shorts Studio.",
            "words": english_words
        }
    ]

    render_result = render_service.render_clip(
        clip_id=test_clip_id,
        source_video_path=temp_landscape_video,
        start_time=0.0,
        end_time=2.2,
        transcript_segments=mock_segments,
        edit_config={
            "aspect_ratio": "9:16",
            "framing": "auto_face",
            "caption_enabled": True,
            "caption_preset": "bold_creator"
        }
    )

    out_file = Path(render_result["output_path"])
    thumb_file = Path(render_result["thumbnail_path"])
    srt_file = Path(render_result["srt_path"])

    assert out_file.exists() and out_file.stat().st_size > 0
    assert thumb_file.exists() and thumb_file.stat().st_size > 0
    assert srt_file.exists() and srt_file.stat().st_size > 0

    print("  -> Render Output Verified:")
    print(f"     Path: {out_file}")
    print(f"     Encoder Used: {render_result['encoder_used'].upper()}")
    print(f"     Resolution: {render_result['width']}x{render_result['height']} (9:16 Vertical)")
    print(f"     Duration: {render_result['duration']}s")
    print(f"     File Size: {round(render_result['file_size_bytes'] / (1024 * 1024), 2)} MB")
    print(f"     Poster Thumbnail: {thumb_file.name}")

    assert render_result["width"] == 1080
    assert render_result["height"] == 1920
    assert render_result["has_captions"] is True

    # 8. Test Re-rendering with Modified Caption Preset (Podcast Style)
    print("\n[Step 8] Testing Re-rendering with Changed Caption Preset (podcast_style)...")
    re_render_result = render_service.render_clip(
        clip_id=test_clip_id,
        source_video_path=temp_landscape_video,
        start_time=0.2,
        end_time=2.0,
        transcript_segments=mock_segments,
        edit_config={
            "aspect_ratio": "9:16",
            "framing": "center",
            "caption_enabled": True,
            "caption_preset": "podcast_style",
            "highlight_color": "#F59E0B"
        }
    )
    assert re_render_result["caption_preset"] == "podcast_style"
    print(f"  -> Re-render completed with preset {re_render_result['caption_preset']} successfully.")

    # 9. Test Full End-to-End API Integration & Downloads
    print("\n[Step 9] Testing End-to-End API Endpoints & Downloads...")
    db = SessionLocal()
    proj = Project(name=f"Phase 5 Rendering Project {uuid.uuid4().hex[:6]}", description="Render testing")
    db.add(proj)
    db.commit()
    db.refresh(proj)

    video = SourceVideo(
        project_id=proj.id,
        title="landscape_render_test.mp4",
        file_path=str(temp_landscape_video),
        file_size_bytes=temp_landscape_video.stat().st_size,
        duration_seconds=2.5,
        width=1280,
        height=720,
        fps=30.0,
        has_audio=True,
        status="transcribed"
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    transcript = Transcript(
        video_id=video.id,
        language="en",
        language_probability=0.99,
        model_name="base",
        device_used="cuda",
        full_text="Welcome to AI Shorts Studio."
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    seg = TranscriptSegment(
        transcript_id=transcript.id,
        segment_index=0,
        start_time=0.0,
        end_time=2.5,
        text="Welcome to AI Shorts Studio.",
        words_json=json.dumps(english_words)
    )
    db.add(seg)
    db.commit()

    clip_row = Clip(
        project_id=proj.id,
        video_id=video.id,
        title="Mastering The 9:16 Vertical Cut",
        start_time=0.0,
        end_time=2.2,
        duration=2.2,
        overall_score=94.0,
        status="approved",
        is_approved=True
    )
    db.add(clip_row)
    db.commit()
    db.refresh(clip_row)

    clip_api_id = clip_row.id
    proj_api_id = proj.id
    video_api_id = video.id
    db.close()

    # Trigger POST /api/clips/{id}/render
    print("  -> Triggering POST /api/clips/{id}/render...")
    render_req = client.post(
        f"/api/clips/{clip_api_id}/render",
        json={
            "aspect_ratio": "9:16",
            "framing": "auto_face",
            "caption_enabled": True,
            "caption_preset": "bold_creator"
        }
    )
    assert render_req.status_code == 200, f"Render trigger failed: {render_req.text}"
    print(f"  -> Render job started successfully: {render_req.json()['job_id']}")

    # Poll /api/clips/{id}/render-status until completion (max 20 seconds)
    print("  -> Polling /api/clips/{id}/render-status for live progress...")
    max_wait = 20
    is_done = False
    for _ in range(max_wait):
        time.sleep(1)
        st_res = client.get(f"/api/clips/{clip_api_id}/render-status")
        assert st_res.status_code == 200
        st_data = st_res.json()
        print(f"     [Progress {st_data['progress_pct']}%] Stage: {st_data['stage']} - {st_data['message']}")
        if st_data["status"] == "completed" or st_data["output_ready"]:
            is_done = True
            break
    assert is_done, "Rendering job did not complete within timeout!"

    # 10. Test Download Endpoints
    print("\n[Step 10] Testing Finished Media Downloads...")
    # MP4 Download
    mp4_res = client.get(f"/api/downloads/clip/{clip_api_id}/mp4")
    assert mp4_res.status_code == 200
    assert mp4_res.headers["content-type"] == "video/mp4"
    assert len(mp4_res.content) > 0
    print(f"  -> Successfully downloaded rendered MP4 ({len(mp4_res.content)} bytes)")

    # Thumbnail Download
    thumb_res = client.get(f"/api/downloads/clip/{clip_api_id}/thumbnail")
    assert thumb_res.status_code == 200
    assert thumb_res.headers["content-type"] == "image/jpeg"
    print(f"  -> Successfully downloaded poster thumbnail ({len(thumb_res.content)} bytes)")

    # SRT Download
    srt_res = client.get(f"/api/downloads/clip/{clip_api_id}/srt")
    assert srt_res.status_code == 200
    print(f"  -> Successfully downloaded SRT subtitles ({len(srt_res.content)} bytes)")

    # Project ZIP Download
    zip_res = client.get(f"/api/downloads/project/{proj_api_id}/zip")
    assert zip_res.status_code == 200
    assert zip_res.headers["content-type"] == "application/zip"
    print(f"  -> Successfully downloaded project zip package ({len(zip_res.content)} bytes)")

    # 11. Test Persistence in SQLite across fresh session
    print("\n[Step 11] Verifying SQLite Database Persistence...")
    db = SessionLocal()
    persisted_clip = db.query(Clip).filter(Clip.id == clip_api_id).first()
    assert persisted_clip is not None
    assert persisted_clip.status == "exported"
    assert persisted_clip.output_path is not None
    assert Path(persisted_clip.output_path).exists()
    print(f"  -> Confirmed clip status='{persisted_clip.status}' and output_path persisted in studio.db")
    db.close()

    # 12. Cleanup temporary test fixtures
    print("\n[Step 12] Cleaning up test fixtures...")
    temp_landscape_video.unlink(missing_ok=True)
    temp_blank_video.unlink(missing_ok=True)
    portrait_video.unlink(missing_ok=True)
    test_ass_en.unlink(missing_ok=True)
    test_srt_en.unlink(missing_ok=True)
    test_ass_hi.unlink(missing_ok=True)
    # Clean up test database rows
    client.delete(f"/api/clips/{clip_api_id}")
    client.delete(f"/api/videos/{video_api_id}")
    client.delete(f"/api/projects/{proj_api_id}")
    print("  -> Test fixtures cleaned up successfully.")

    print("\n" + "=" * 70)
    print("     ALL PHASE 5 VIDEO RENDERING & EDITING TESTS PASSED (100%)!")
    print("=" * 70)

if __name__ == "__main__":
    run_phase5_tests()
