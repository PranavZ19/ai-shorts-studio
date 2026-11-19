import os
import sys
import json
import subprocess
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
from app.services.transcription_service import transcription_service

client = TestClient(app)

def run_phase3_tests():
    print("=" * 65)
    print("       STARTING PHASE 3 COMPREHENSIVE TRANSCRIPTION TESTS")
    print("=" * 65)

    # 1. Create a Project
    print("\n[Step 1] Creating Project for Transcription Testing...")
    proj_res = client.post("/api/projects/", json={"name": "Phase 3 Speech Transcription Project", "description": "Faster-Whisper verification"})
    assert proj_res.status_code == 200, f"Failed to create project: {proj_res.text}"
    project = proj_res.json()
    project_id = project["id"]
    print(f"  -> Project created with ID: {project_id}")

    # 2. Build real video from spoken audio
    wav_path = settings.TEMP_DIR / "real_english_speech.wav"
    assert wav_path.exists(), f"Spoken speech WAV not found at {wav_path}"
    
    video_path = settings.TEMP_DIR / "english_spoken_video.mp4"
    if video_path.exists():
        video_path.unlink()

    print("\n[Step 2] Muxing real spoken speech into MP4 container with FFmpeg...")
    cmd = [
        settings.FFMPEG_BIN, "-y",
        "-f", "lavfi", "-i", "color=c=black:s=1280x720:r=30",
        "-i", str(wav_path),
        "-c:v", "libx264", "-tune", "stillimage", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(video_path)
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, timeout=20)
    assert res.returncode == 0, f"FFmpeg failed to create spoken video: {res.stderr}"
    assert video_path.exists() and video_path.stat().st_size > 0
    print(f"  -> Spoken video ready: {video_path} ({video_path.stat().st_size} bytes)")

    # 3. Ingest video into project
    print("\n[Step 3] Ingesting spoken video into AI Shorts Studio...")
    with open(video_path, "rb") as vf:
        upload_res = client.post(
            "/api/videos/upload/direct",
            data={"project_id": project_id},
            files={"file": ("english_spoken_video.mp4", vf, "video/mp4")}
        )
    assert upload_res.status_code == 200, f"Video upload failed: {upload_res.text}"
    video_data = upload_res.json()
    video_id = video_data["id"]
    print(f"  -> Video registered with ID: {video_id}, duration: {video_data['duration']}s")

    # 4. English Transcription on CUDA with Faster-Whisper (base model)
    print("\n[Step 4] Running Faster-Whisper Transcription on CUDA (base model)...")
    trans_res = client.post(
        f"/api/transcripts/video/{video_id}/transcribe",
        json={"model_name": "base", "language": "auto", "force_cpu": False}
    )
    assert trans_res.status_code == 200, f"Transcription failed: {trans_res.text}"
    result = trans_res.json()
    transcript_id = result["transcript_id"]
    print(f"  -> Transcription completed successfully!")
    print(f"     Model: {result['model_name']}")
    print(f"     Device Used: {result['device_used'].upper()}")
    print(f"     Detected Language: {result['language'].upper()} (Confidence: {result['language_probability']})")
    print(f"     Segment Count: {result['segment_count']}")
    print(f"     Transcribed Text: \"{result['full_text']}\"")

    assert result["language"] == "en", f"Expected language 'en', got {result['language']}"
    assert "shorts studio" in result["full_text"].lower() or "faster whisper" in result["full_text"].lower(), "Transcription content did not match spoken words!"

    # 5. Verify Word-Level Timestamps
    print("\n[Step 5] Verifying Word-Level Timestamps & Segments...")
    detail_res = client.get(f"/api/transcripts/video/{video_id}")
    assert detail_res.status_code == 200
    details = detail_res.json()
    assert details["found"] is True
    assert len(details["segments"]) > 0

    first_seg = details["segments"][0]
    print(f"  -> First Segment: [{first_seg['start_time']}s - {first_seg['end_time']}s] \"{first_seg['text']}\"")
    assert len(first_seg["words"]) > 0, "Word-level timestamps were not generated!"
    print(f"     Total words in segment: {len(first_seg['words'])}")
    print(f"     First word sample: {first_seg['words'][0]}")
    assert "start" in first_seg["words"][0] and "end" in first_seg["words"][0] and "word" in first_seg["words"][0]

    # 6. Verify Model Weights Stored on D:
    print("\n[Step 6] Verifying Whisper Model Storage on D:\\AI-Shorts-Studio\\storage\\models...")
    models_dir = settings.MODELS_DIR
    models_found = list(models_dir.glob("*"))
    print(f"  -> Items in models directory: {[m.name for m in models_found]}")
    assert any("whisper" in m.name.lower() or "models--" in m.name.lower() or "huggingface" in m.name.lower() for m in models_found), "Model weights not stored under D: storage!"

    # 7. Test Transcript Editing & Saving
    print("\n[Step 7] Testing Segment Text Editing & Distinguishing Original Text...")
    seg_id = first_seg["id"]
    original_text = first_seg["text"]
    edited_text = original_text + " [Verified by User]"

    edit_res = client.put(f"/api/transcripts/segments/{seg_id}", json={
        "text": edited_text,
        "speaker": "Host"
    })
    assert edit_res.status_code == 200, f"Edit segment failed: {edit_res.text}"
    edit_data = edit_res.json()
    print(f"  -> Segment updated:")
    print(f"     Original: \"{edit_data['original_text']}\"")
    print(f"     Current:  \"{edit_data['text']}\"")
    print(f"     is_edited flag: {edit_data['is_edited']}")
    print(f"     Speaker: {edit_data['speaker']}")

    assert edit_data["is_edited"] is True
    assert edit_data["original_text"] == original_text
    assert edit_data["text"] == edited_text

    # 8. Test Subtitle Exports (SRT & VTT)
    print("\n[Step 8] Testing Subtitle Exports (.SRT and .VTT)...")
    srt_res = client.get(f"/api/transcripts/{transcript_id}/export?format=srt")
    assert srt_res.status_code == 200
    srt_content = srt_res.text
    print(f"  -> Generated SRT (first 150 chars):\n{srt_content[:150]}")
    assert "-->" in srt_content, "SRT does not contain standard timestamp arrows!"

    vtt_res = client.get(f"/api/transcripts/{transcript_id}/export?format=vtt")
    assert vtt_res.status_code == 200
    vtt_content = vtt_res.text
    print(f"  -> Generated VTT header: {vtt_content.splitlines()[0]}")
    assert vtt_content.startswith("WEBVTT"), "VTT does not start with WEBVTT header!"

    # 9. Test CPU Fallback
    print("\n[Step 9] Testing CPU Fallback Mode (tiny model)...")
    cpu_res = client.post(
        f"/api/transcripts/video/{video_id}/transcribe",
        json={"model_name": "tiny", "language": "en", "force_cpu": True}
    )
    assert cpu_res.status_code == 200, f"CPU transcription failed: {cpu_res.text}"
    cpu_result = cpu_res.json()
    print(f"  -> CPU transcription completed successfully:")
    print(f"     Model: {cpu_result['model_name']}")
    print(f"     Device Used: {cpu_result['device_used'].upper()}")
    assert cpu_result["device_used"] == "cpu", f"Expected CPU device, got {cpu_result['device_used']}"

    # 10. Verify SQLite Persistence across new connection
    print("\n[Step 10] Verifying SQLite Persistence...")
    db = SessionLocal()
    saved_t = db.query(Transcript).filter(Transcript.video_id == video_id).first()
    assert saved_t is not None
    assert len(saved_t.segments) > 0
    print(f"  -> Confirmed transcript and {len(saved_t.segments)} segments persisted in studio.db")
    db.close()

    # 11. Cleanup temporary test video
    print("\n[Step 11] Cleaning up temporary test fixtures...")
    wav_path.unlink(missing_ok=True)
    video_path.unlink(missing_ok=True)
    # Also delete the test video through the API to verify clean cascading delete
    del_res = client.delete(f"/api/videos/{video_id}")
    assert del_res.status_code == 200
    print("  -> Temporary fixtures cleaned up successfully.")

    print("\n" + "=" * 65)
    print("     ALL PHASE 3 TRANSCRIPTION TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 65)

if __name__ == "__main__":
    run_phase3_tests()
