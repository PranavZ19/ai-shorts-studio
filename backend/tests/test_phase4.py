import os
import sys
import uuid
import json
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
from app.services.clip_finder_service import ClipFinderService

client = TestClient(app)

def run_phase4_tests():
    print("=" * 65)
    print("       STARTING PHASE 4 INTELLIGENT AI CLIP FINDER TESTS")
    print("=" * 65)

    # 1. Test Clip Engine Status Endpoint
    print("\n[Step 1] Testing Clip Engine Status Endpoint (GET /api/clips/status)...")
    status_res = client.get("/api/clips/status")
    assert status_res.status_code == 200, f"Status check failed: {status_res.text}"
    status_data = status_res.json()
    print(f"  -> Heuristic Fallback Available: {status_data['heuristic_fallback_available']}")
    print(f"  -> Recommended Model: {status_data['recommended_model']}")
    print(f"  -> Ollama Available: {status_data['ollama_available']}")
    assert status_data["heuristic_fallback_available"] is True
    assert status_data["recommended_model"] == "qwen2.5:3b"

    # 2. Test Word Boundary Snapping Algorithm
    print("\n[Step 2] Testing Word Boundary Snapping to Natural Speech Closures...")
    service = ClipFinderService()
    mock_segments = [
        {
            "start_time": 10.0,
            "end_time": 16.5,
            "words": [
                {"word": "Did", "start": 10.0, "end": 10.3, "probability": 0.98},
                {"word": "you", "start": 10.3, "end": 10.5, "probability": 0.99},
                {"word": "know?", "start": 10.5, "end": 11.2, "probability": 0.95},
                {"word": "This", "start": 11.8, "end": 12.1, "probability": 0.97},
                {"word": "is", "start": 12.1, "end": 12.3, "probability": 0.99},
                {"word": "crucial.", "start": 12.3, "end": 13.0, "probability": 0.96},
            ]
        },
        {
            "start_time": 16.5,
            "end_time": 35.0,
            "words": [
                {"word": "Here", "start": 17.0, "end": 17.3, "probability": 0.99},
                {"word": "is", "start": 17.3, "end": 17.5, "probability": 0.99},
                {"word": "why", "start": 17.5, "end": 17.8, "probability": 0.98},
                {"word": "everything", "start": 17.8, "end": 18.5, "probability": 0.95},
                {"word": "changes.", "start": 32.0, "end": 33.2, "probability": 0.94},
                {"word": "And", "start": 33.5, "end": 33.8, "probability": 0.88},
            ]
        }
    ]

    snapped_start, snapped_end = service.snap_boundaries_to_words(
        start_time=10.2,
        end_time=32.5,
        segments=mock_segments,
        max_duration=60.0,
        min_duration=15.0
    )
    print(f"  -> Raw bounds: 10.2s - 32.5s | Snapped: {snapped_start}s - {snapped_end}s (Duration: {round(snapped_end - snapped_start, 2)}s)")
    assert snapped_start <= 10.3, f"Expected start <= 10.3, got {snapped_start}"
    assert snapped_end == 33.2, f"Expected end snapped to sentence closure 'changes.' (33.2s), got {snapped_end}"
    assert (snapped_end - snapped_start) >= 15.0

    # 3. Test Virality Score Rubric Calibration
    print("\n[Step 3] Testing 8-Factor Virality Rubric Weight Calculation...")
    scores = {
        "hook": 100.0,         # 20% -> 20.0
        "emotional": 80.0,     # 15% -> 12.0
        "curiosity": 90.0,     # 15% -> 13.5
        "story": 70.0,         # 15% -> 10.5
        "information": 80.0,   # 10% -> 8.0
        "clarity": 90.0,       # 10% -> 9.0
        "shareability": 85.0,  # 10% -> 8.5
        "ending": 100.0        # 5%  -> 5.0
    }
    overall = service.calculate_overall_score(scores)
    print(f"  -> Calculated Composite Score: {overall} / 100")
    assert abs(overall - 86.5) < 0.1, f"Expected 86.5, got {overall}"

    # 4. Test Candidate Deduplication & Overlap Suppression
    print("\n[Step 4] Testing Candidate Overlap Suppression (>60% threshold)...")
    candidates = [
        {"title": "High Scorer", "start_time": 10.0, "end_time": 45.0, "overall_score": 92.0},
        {"title": "Overlapping Duplicate", "start_time": 12.0, "end_time": 44.0, "overall_score": 75.0},
        {"title": "Separate Later Clip", "start_time": 60.0, "end_time": 95.0, "overall_score": 85.0}
    ]
    deduped = service.deduplicate_candidates(candidates, max_overlap_ratio=0.60)
    titles = [c["title"] for c in deduped]
    print(f"  -> Kept Candidates: {titles}")
    assert len(deduped) == 2
    assert "High Scorer" in titles
    assert "Separate Later Clip" in titles
    assert "Overlapping Duplicate" not in titles

    # 5. Test Rule-based NLP Heuristic Analysis Engine
    print("\n[Step 5] Testing NLP Heuristic Moment Detection & Title Generation...")
    nlp_segments = [
        {
            "segment_index": 0,
            "start_time": 0.0,
            "end_time": 8.0,
            "text": "Did you know that 99% of people make this crazy mistake in video creation?",
            "words": [
                {"word": "Did", "start": 0.0, "end": 0.3, "probability": 0.99},
                {"word": "you", "start": 0.3, "end": 0.5, "probability": 0.99},
                {"word": "know", "start": 0.5, "end": 0.8, "probability": 0.98},
                {"word": "mistake?", "start": 7.0, "end": 7.8, "probability": 0.95}
            ]
        },
        {
            "segment_index": 1,
            "start_time": 8.0,
            "end_time": 20.0,
            "text": "The secret reason is because they ignore the opening three seconds completely.",
            "words": [
                {"word": "The", "start": 8.0, "end": 8.2, "probability": 0.99},
                {"word": "secret", "start": 8.2, "end": 8.6, "probability": 0.98},
                {"word": "completely.", "start": 19.0, "end": 19.8, "probability": 0.94}
            ]
        },
        {
            "segment_index": 2,
            "start_time": 20.0,
            "end_time": 35.0,
            "text": "When you fix this single formula, your retention skyrockets instantly. That is the truth.",
            "words": [
                {"word": "When", "start": 20.0, "end": 20.3, "probability": 0.99},
                {"word": "truth.", "start": 34.0, "end": 34.8, "probability": 0.95}
            ]
        }
    ]
    nlp_results = service.analyze_with_heuristic(
        segments=nlp_segments,
        target_count=3,
        target_duration=30.0,
        min_duration=15.0,
        max_duration=45.0
    )
    assert len(nlp_results) >= 1
    top_c = nlp_results[0]
    print(f"  -> Generated Title: {top_c['title']}")
    print(f"  -> Overall Score: {top_c['overall_score']} / 100")
    print(f"  -> Hook Score: {top_c['hook_score']} / 100")
    print(f"  -> Mode: {top_c['analysis_mode']}")
    print(f"  -> 5 Alternative Titles: {top_c['ai_metadata']['titles']}")
    print(f"  -> Hashtags: {top_c['ai_metadata']['hashtags'][:4]}...")
    assert top_c["analysis_mode"] == "heuristic_fallback"
    assert len(top_c["ai_metadata"]["titles"]) == 5
    assert len(top_c["ai_metadata"]["descriptions"]) == 2
    assert len(top_c["ai_metadata"]["hashtags"]) >= 5

    # 6. Test End-to-End Database Integration & API Lifecycle
    print("\n[Step 6] Testing End-to-End API Integration & SQLite Database Persistence...")
    db = SessionLocal()
    proj = Project(name=f"Phase4 Project {uuid.uuid4().hex[:6]}", description="Clip testing")
    db.add(proj)
    db.commit()
    db.refresh(proj)

    video = SourceVideo(
        project_id=proj.id,
        title="speech_phase4.mp4",
        file_path=f"D:\\AI-Shorts-Studio\\storage\\source_videos\\speech_{proj.id}.mp4",
        file_size_bytes=1024000,
        duration_seconds=120.0,
        width=1920,
        height=1080,
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
        full_text="Welcome to this masterclass. The secret formula for YouTube shorts begins with a powerful hook. If you lose the viewer in three seconds, the algorithm drops your video immediately. Here is the trick: never start with your name. Start with the mystery."
    )
    db.add(transcript)
    db.commit()
    db.refresh(transcript)

    seg1 = TranscriptSegment(
        transcript_id=transcript.id,
        segment_index=0,
        start_time=0.0,
        end_time=12.0,
        text="Welcome to this masterclass. The secret formula for YouTube shorts begins with a powerful hook.",
        words_json=json.dumps([
            {"word": "Welcome", "start": 0.0, "end": 0.5, "probability": 0.99},
            {"word": "to", "start": 0.5, "end": 0.7, "probability": 0.99},
            {"word": "hook.", "start": 11.0, "end": 11.8, "probability": 0.96}
        ])
    )
    seg2 = TranscriptSegment(
        transcript_id=transcript.id,
        segment_index=1,
        start_time=12.0,
        end_time=28.0,
        text="If you lose the viewer in three seconds, the algorithm drops your video immediately.",
        words_json=json.dumps([
            {"word": "If", "start": 12.0, "end": 12.3, "probability": 0.98},
            {"word": "immediately.", "start": 27.0, "end": 27.8, "probability": 0.95}
        ])
    )
    seg3 = TranscriptSegment(
        transcript_id=transcript.id,
        segment_index=2,
        start_time=28.0,
        end_time=45.0,
        text="Here is the trick: never start with your name. Start with the mystery and keep them watching until the end.",
        words_json=json.dumps([
            {"word": "Here", "start": 28.0, "end": 28.3, "probability": 0.99},
            {"word": "end.", "start": 44.0, "end": 44.8, "probability": 0.95}
        ])
    )
    db.add_all([seg1, seg2, seg3])
    db.commit()
    video_id = video.id
    proj_id = proj.id
    db.close()

    # Trigger POST /api/clips/analyze
    print("  -> Triggering POST /api/clips/analyze...")
    res = client.post("/api/clips/analyze", json={
        "video_id": video_id,
        "target_count": 3,
        "target_duration": 30.0,
        "force_heuristic": True
    })
    assert res.status_code == 200, f"Analysis failed: {res.text}"
    res_data = res.json()
    assert res_data["success"] is True
    assert res_data["video_id"] == video_id
    assert res_data["clips_found"] >= 1
    print(f"  -> Success: Generated {res_data['clips_found']} clips in database")

    created_clip = res_data["clips"][0]
    clip_id = created_clip["id"]
    print(f"  -> Top Clip ID: {clip_id}")
    print(f"  -> Title: {created_clip['title']}")
    print(f"  -> Duration: {created_clip['duration']}s ({created_clip['start_time']}s to {created_clip['end_time']}s)")
    print(f"  -> Overall Score: {created_clip['overall_score']} / 100")

    # 7. Test GET /api/clips/?video_id=...
    print("\n[Step 7] Testing GET /api/clips/?video_id=...")
    get_res = client.get(f"/api/clips/?video_id={video_id}")
    assert get_res.status_code == 200
    assert len(get_res.json()) >= 1
    print(f"  -> Successfully listed {len(get_res.json())} clips for video")

    # 8. Test PATCH /api/clips/{id}/approval
    print("\n[Step 8] Testing Approval Toggle (PATCH /api/clips/{id}/approval)...")
    appr_res = client.patch(f"/api/clips/{clip_id}/approval", json={"is_approved": True})
    assert appr_res.status_code == 200
    assert appr_res.json()["is_approved"] is True
    assert appr_res.json()["status"] == "approved"
    print("  -> Clip successfully approved.")

    # 9. Test PUT /api/clips/{id} for boundary trimming
    print("\n[Step 9] Testing Boundary Trimming & Editing (PUT /api/clips/{id})...")
    upd_res = client.put(f"/api/clips/{clip_id}", json={
        "title": "Mastering The Opening Hook",
        "start_time": 2.5,
        "end_time": 32.5
    })
    assert upd_res.status_code == 200
    upd_data = upd_res.json()
    assert upd_data["clip"]["title"] == "Mastering The Opening Hook"
    assert upd_data["clip"]["start_time"] == 2.5
    assert upd_data["clip"]["end_time"] == 32.5
    assert upd_data["clip"]["duration"] == 30.0
    print(f"  -> Clip title updated to: {upd_data['clip']['title']}")
    print(f"  -> Clip boundaries trimmed to: {upd_data['clip']['start_time']}s - {upd_data['clip']['end_time']}s (Duration: {upd_data['clip']['duration']}s)")

    # 10. Test DELETE /api/clips/{id}
    print("\n[Step 10] Testing Clip Deletion (DELETE /api/clips/{id})...")
    del_res = client.delete(f"/api/clips/{clip_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted_clip_id"] == clip_id
    after_del = client.get(f"/api/clips/{clip_id}")
    assert after_del.status_code == 404
    print("  -> Clip successfully deleted and confirmed 404.")

    # Cleanup test project & video
    del_v = client.delete(f"/api/videos/{video_id}")
    assert del_v.status_code == 200
    client.delete(f"/api/projects/{proj_id}")

    print("\n" + "=" * 65)
    print("     ALL PHASE 4 CLIP FINDER TESTS PASSED WITH 100% SUCCESS!")
    print("=" * 65)

if __name__ == "__main__":
    run_phase4_tests()
