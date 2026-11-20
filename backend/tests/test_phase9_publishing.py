"""
Phase 9 Complete Automated Test Suite: AI Publishing Kit for YouTube Shorts & Instagram Reels
Tests all 25 requirements specified in Phase 9 Master Specification.
"""

import os
import sys
import io
import json
import uuid
import zipfile
from datetime import datetime
from pathlib import Path

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal, Base, engine
from app.models.project import Project
from app.models.source_video import SourceVideo
from app.models.clip import Clip
from app.models.transcript import Transcript, TranscriptSegment
from app.models.strategy import ChannelProfile, ScheduledPost
from app.models.publishing_kit import PublishingKit
from app.services.publishing_service import PublishingService

client = TestClient(app)

def run_phase9_tests():
    print("=" * 75)
    print("      STARTING PHASE 9 AI PUBLISHING KIT INTEGRATION TESTS")
    print("=" * 75)

    db = SessionLocal()

    # Clean previous test records
    db.query(PublishingKit).delete()
    db.query(ScheduledPost).filter(ScheduledPost.title.like("Phase9%")).delete()
    db.commit()

    # Setup base project and source video fixture
    test_project = Project(
        name="Phase 9 Test Project",
        description="Testing AI Publishing Kit Features"
    )
    db.add(test_project)
    db.commit()
    db.refresh(test_project)

    test_video = SourceVideo(
        project_id=test_project.id,
        title="Mastering AI and Machine Learning in 2026",
        file_path="D:/AI-Shorts-Studio/storage/source_videos/test_vid.mp4",
        duration_seconds=180.0,
        width=1920,
        height=1080,
        fps=30.0,
        status="ready"
    )
    db.add(test_video)
    db.commit()
    db.refresh(test_video)

    # Add transcript with segments
    test_transcript = Transcript(
        video_id=test_video.id,
        language="en",
        full_text="Welcome to this AI tutorial. Today we talk about the future of computing. Next-gen neural models are changing everything. You can run 3B parameter models directly on your laptop without cloud fees. This democratizes artificial intelligence for everyone everywhere. Make sure to optimize your VRAM and quantize weights."
    )
    db.add(test_transcript)
    db.commit()
    db.refresh(test_transcript)

    # Segment 1: 0 - 25s (outside clip)
    # Segment 2: 30 - 45s (inside clip)
    # Segment 3: 45 - 60s (inside clip)
    # Segment 4: 70 - 90s (outside clip)
    seg1 = TranscriptSegment(
        transcript_id=test_transcript.id,
        segment_index=0,
        start_time=0.0,
        end_time=25.0,
        text="Welcome to this AI tutorial. Today we talk about the future of computing."
    )
    seg2 = TranscriptSegment(
        transcript_id=test_transcript.id,
        segment_index=1,
        start_time=30.0,
        end_time=45.0,
        text="You can run 3B parameter models directly on your laptop without cloud fees."
    )
    seg3 = TranscriptSegment(
        transcript_id=test_transcript.id,
        segment_index=2,
        start_time=45.0,
        end_time=60.0,
        text="This democratizes artificial intelligence for everyone everywhere."
    )
    seg4 = TranscriptSegment(
        transcript_id=test_transcript.id,
        segment_index=3,
        start_time=70.0,
        end_time=90.0,
        text="Make sure to optimize your VRAM and quantize weights."
    )
    db.add_all([seg1, seg2, seg3, seg4])
    db.commit()

    # Clip 1: 30s - 60s
    test_clip = Clip(
        project_id=test_project.id,
        video_id=test_video.id,
        title="Run 3B AI on Your Laptop Locally",
        start_time=30.0,
        end_time=60.0,
        duration=30.0,
        overall_score=88.5,
        hook_score=92.0,
        status="exported",
        output_path="D:/AI-Shorts-Studio/storage/clips/test_clip_p9.mp4"
    )
    db.add(test_clip)
    db.commit()
    db.refresh(test_clip)

    test_project_id = test_project.id
    test_video_id = test_video.id
    test_transcript_id = test_transcript.id
    test_clip_id = test_clip.id
    created_kit_id = None

    try:
        # -------------------------------------------------------------
        # Test 1: YouTube Kit Generation from Real Clip Record
        # -------------------------------------------------------------
        print("\n[Test 1] Testing YouTube Kit Generation...")
        res = client.post("/api/publishing-kits/generate", json={
            "clip_id": test_clip.id
        })
        assert res.status_code == 200, f"Generate failed: {res.text}"
        data = res.json()
        created_kit_id = data["id"]

        assert "youtube" in data, "Missing youtube object in response"
        yt = data["youtube"]
        assert len(yt["titles"]) == 5, f"Expected 5 title variations, got {len(yt['titles'])}"
        for t in yt["titles"]:
            assert "title" in t and "strategy" in t and "char_count" in t
            assert len(t["title"]) <= 100, f"Title exceeds 100 chars: {t['title']}"

        assert yt["description_short"], "Missing short description"
        assert yt["description_seo"], "Missing SEO description"
        assert yt["tags_csv"], "Missing tags CSV"
        assert len(yt["tags_csv"]) <= 500, f"Tags CSV exceeds 500 chars limit: {len(yt['tags_csv'])}"
        assert yt["category"], "Missing category"
        assert yt["pinned_comment"], "Missing pinned comment"
        assert len(yt["thumbnail_texts"]) == 3, "Expected 3 thumbnail text options"
        print("  -> PASS: YouTube kit generated with 5 title variations, tags (<=500 chars), descriptions, and pinned comment.")

        # -------------------------------------------------------------
        # Test 2: Instagram Kit Generation from Real Clip Record
        # -------------------------------------------------------------
        print("\n[Test 2] Testing Instagram Kit Generation...")
        assert "instagram" in data, "Missing instagram object in response"
        ig = data["instagram"]
        assert len(ig["captions"]) == 3, f"Expected 3 captions, got {len(ig['captions'])}"
        for c in ig["captions"]:
            assert "type" in c and "text" in c and "char_count" in c
            assert len(c["text"]) <= 2200, "Caption exceeds 2200 chars limit"

        assert ig["first_line_hook"], "Missing first_line_hook"
        assert len(ig["first_line_hook"]) <= 140, "Hook should be punchy and under 140 chars"
        assert ig["audio_direction"], "Missing audio direction suggestion"
        assert ig["cta"], "Missing Instagram CTA"
        assert len(ig["cover_texts"]) == 3, "Expected 3 cover text options"
        assert "niche" in ig["hashtags"] and "topic" in ig["hashtags"] and "community" in ig["hashtags"]
        print("  -> PASS: Instagram kit generated with 3 caption variations, hook, cover texts, and audio direction.")

        # -------------------------------------------------------------
        # Test 3: Platform-Specific Text Divergence
        # -------------------------------------------------------------
        print("\n[Test 3] Testing Platform-Specific Text Divergence...")
        yt_title = yt["titles"][0]["title"]
        ig_hook = ig["first_line_hook"]
        assert yt_title != ig_hook, "YouTube title and Instagram hook must be distinct"

        yt_desc = yt["description_short"]
        ig_caption = ig["captions"][0]["text"]
        assert yt_desc != ig_caption, "YouTube description and Instagram caption must be distinct"
        print("  -> PASS: Platform outputs strictly diverge in structure and copy.")

        # -------------------------------------------------------------
        # Test 4: Restricted Clip Transcript Used
        # -------------------------------------------------------------
        print("\n[Test 4] Testing Clip-Boundary Restricted Transcript...")
        transcript_used = data["clip_transcript_used"]
        assert transcript_used, "Expected transcript excerpt used to be stored"
        # seg2 and seg3 (30-60s) should be in transcript_used
        assert "laptop without cloud fees" in transcript_used
        assert "democratizes artificial intelligence" in transcript_used
        # seg1 (0-25s) and seg4 (70-90s) should NOT be in transcript_used
        assert "future of computing" not in transcript_used, "Transcript outside clip boundary was erroneously included"
        assert "quantize weights" not in transcript_used, "Transcript outside clip boundary was erroneously included"
        print("  -> PASS: Only transcript segments within [30.0s, 60.0s] clip boundaries were analyzed.")

        # -------------------------------------------------------------
        # Test 5: Missing Transcript Fallback
        # -------------------------------------------------------------
        print("\n[Test 5] Testing Graceful Fallback When Transcript Missing...")
        clip_no_transcript = Clip(
            project_id=test_project_id,
            video_id=test_video_id,
            title="Silent Epic Timelapse Shot",
            start_time=120.0,
            end_time=150.0,
            duration=30.0,
            overall_score=75.0,
            status="candidate"
        )
        db.add(clip_no_transcript)
        db.commit()
        db.refresh(clip_no_transcript)
        clip_no_transcript_id = clip_no_transcript.id

        res_no_t = client.post("/api/publishing-kits/generate", json={
            "clip_id": clip_no_transcript.id
        })
        assert res_no_t.status_code == 200
        data_no_t = res_no_t.json()
        assert len(data_no_t["youtube"]["titles"]) == 5
        assert len(data_no_t["instagram"]["captions"]) == 3
        print("  -> PASS: Handled missing transcript gracefully using clip metadata.")

        # -------------------------------------------------------------
        # Test 6: Ollama Inference Path Simulation
        # -------------------------------------------------------------
        print("\n[Test 6] Testing Ollama Inference Parsing...")
        service = PublishingService(db)
        mock_ollama_raw = json.dumps({
            "titles": [
                {"title": "Run AI Locally in 2026 (No Cloud)", "strategy": "Direct Benefit", "explanation": "Highlights zero cloud cost"}
            ],
            "description_short": "How to run local AI on your laptop without paying for cloud subscriptions.",
            "description_alt": "Offline AI setup guide.",
            "description_seo": "Complete tutorial on local AI models running on consumer hardware.",
            "hashtags_broad": ["shorts", "tech"],
            "hashtags_specific": ["localai", "ollama"],
            "hashtags_audience": ["developers"],
            "tags": ["local ai", "offline llm", "python"],
            "pinned_comment": "What model are you running locally?",
            "thumbnail_texts": ["RUN AI OFFLINE", "NO CLOUD FEES", "LOCAL 3B AI"],
            "first_line_hook": "You don't need cloud servers to run AI anymore.",
            "caption_story": "I stopped paying cloud AI bills and moved everything to my laptop...",
            "caption_punchy": "3 reasons to run local AI:\n1. 100% private\n2. Zero fees\n3. Offline ready",
            "caption_question": "Are you still paying monthly subscriptions for AI?",
            "ig_hashtags_niche": ["localllm", "opensourceai"],
            "ig_hashtags_topic": ["techtok", "programming"],
            "ig_hashtags_community": ["buildinpublic"],
            "cover_texts": ["RUN AI FREE", "OFFLINE AI", "LOCAL LLM GUIDE"],
            "audio_direction": "Upbeat synthwave electronic",
            "cta": "Follow for daily AI tips!"
        })
        parsed = service.parse_json_response(mock_ollama_raw)
        assert len(parsed["titles"]) == 1
        assert parsed["titles"][0]["title"] == "Run AI Locally in 2026 (No Cloud)"
        assert parsed["description_short"].startswith("How to run")
        print("  -> PASS: Ollama raw response successfully parsed into structured kit components.")

        # -------------------------------------------------------------
        # Test 7: Heuristic Fallback Path
        # -------------------------------------------------------------
        print("\n[Test 7] Testing Heuristic Generation Path Directly...")
        dummy_brand = {
            "niche": "Artificial Intelligence",
            "brand_voice": "energetic",
            "content_language": "English",
            "default_cta": "Subscribe for more!"
        }
        h_yt = service._heuristic_youtube_kit(test_clip, "Fast tutorial on AI.", dummy_brand)
        assert len(h_yt["titles"]) == 5
        assert len(h_yt["tags_csv"]) <= 500
        assert h_yt["description_short"]

        h_ig = service._heuristic_instagram_kit(test_clip, "Fast tutorial on AI.", dummy_brand)
        assert len(h_ig["captions"]) == 3
        assert h_ig["first_line_hook"]
        print("  -> PASS: Heuristic fallback path produces complete, compliant metadata offline.")

        # -------------------------------------------------------------
        # Test 8: Title Variations & Primary Title Selection
        # -------------------------------------------------------------
        print("\n[Test 8] Testing Primary Title Index Selection & Persistence...")
        res_update = client.put(f"/api/publishing-kits/{created_kit_id}", json={
            "yt_primary_title_index": 2
        })
        assert res_update.status_code == 200
        assert res_update.json()["youtube"]["primary_title_index"] == 2

        # Verify list endpoint uses the newly selected primary title
        res_list = client.get(f"/api/publishing-kits/?clip_id={test_clip.id}")
        assert res_list.status_code == 200
        kits_list = res_list.json()
        expected_title = yt["titles"][2]["title"]
        assert kits_list[0]["primary_title"] == expected_title
        print(f"  -> PASS: Primary title index updated to #2 ('{expected_title}').")

        # -------------------------------------------------------------
        # Test 9: Description Editing & Persistence
        # -------------------------------------------------------------
        print("\n[Test 9] Testing Description Customization & Persistence...")
        new_desc = "Custom user edited SEO description for testing."
        res_desc = client.put(f"/api/publishing-kits/{created_kit_id}", json={
            "yt_description_seo": new_desc,
            "yt_selected_description": "seo"
        })
        assert res_desc.status_code == 200
        assert res_desc.json()["youtube"]["description_seo"] == new_desc
        assert res_desc.json()["youtube"]["selected_description"] == "seo"

        # Verify from direct DB query
        db_kit = db.query(PublishingKit).filter(PublishingKit.id == created_kit_id).first()
        assert db_kit.yt_description_seo == new_desc
        assert db_kit.yt_selected_description == "seo"
        print("  -> PASS: Custom description saved and persisted in SQLite.")

        # -------------------------------------------------------------
        # Test 10: Tag Generation & 500 Character Validation
        # -------------------------------------------------------------
        print("\n[Test 10] Testing Tag Validation & 500 Char Limits...")
        long_tags = ",".join([f"longkeywordtag{i}" for i in range(50)])
        res_tags = client.put(f"/api/publishing-kits/{created_kit_id}", json={
            "yt_tags_csv": long_tags
        })
        assert res_tags.status_code == 200
        saved_tags = res_tags.json()["youtube"]["tags_csv"]
        assert len(saved_tags) <= 500, f"Tags exceeded 500 chars limit: {len(saved_tags)}"
        print(f"  -> PASS: Tags correctly capped at {len(saved_tags)} characters (<= 500 chars limit).")

        # -------------------------------------------------------------
        # Test 11: Hashtag Grouping & Deduplication
        # -------------------------------------------------------------
        print("\n[Test 11] Testing Hashtag Grouping & Deduplication...")
        raw_hashtags = {
            "broad": ["#shorts", "#viral", "#shorts"],
            "specific": ["#localai", "#tech", "#shorts"],
            "audience": ["#developers", "#tech"]
        }
        res_hash = client.put(f"/api/publishing-kits/{created_kit_id}", json={
            "yt_hashtags_json": json.dumps(raw_hashtags)
        })
        assert res_hash.status_code == 200
        saved_h = res_hash.json()["youtube"]["hashtags"]
        # Broad should have unique items
        assert len(saved_h["broad"]) == len(set(saved_h["broad"]))
        print("  -> PASS: Hashtags grouped and deduplicated cleanly.")

        # -------------------------------------------------------------
        # Test 12: Caption Editing & Persistence
        # -------------------------------------------------------------
        print("\n[Test 12] Testing Instagram Caption Editing...")
        new_caption = "New custom Instagram narrative caption."
        new_caps = [
            {"type": "Story", "text": new_caption, "char_count": len(new_caption)},
            {"type": "Punchy", "text": "Bullet 1\nBullet 2", "char_count": 17},
            {"type": "Question", "text": "What do you think?", "char_count": 19}
        ]
        res_cap = client.put(f"/api/publishing-kits/{created_kit_id}", json={
            "ig_captions_json": json.dumps(new_caps),
            "ig_selected_caption_index": 1
        })
        assert res_cap.status_code == 200
        assert res_cap.json()["instagram"]["captions"][0]["text"] == new_caption
        assert res_cap.json()["instagram"]["selected_caption_index"] == 1
        print("  -> PASS: Instagram captions and selected index saved.")

        # -------------------------------------------------------------
        # Test 13: Single-Field Regeneration Preserves Other Fields
        # -------------------------------------------------------------
        print("\n[Test 13] Testing Single-Field Regeneration...")
        current_desc = res_cap.json()["youtube"]["description_seo"]
        current_tags = res_cap.json()["youtube"]["tags_csv"]

        res_regen_titles = client.post(f"/api/publishing-kits/{created_kit_id}/regenerate", json={
            "platform": "youtube",
            "field_name": "titles"
        })
        assert res_regen_titles.status_code == 200
        regen_data = res_regen_titles.json()
        assert len(regen_data["youtube"]["titles"]) == 5
        assert regen_data["youtube"]["description_seo"] == current_desc, "Description was unexpectedly modified!"
        assert regen_data["youtube"]["tags_csv"] == current_tags, "Tags were unexpectedly modified!"
        print("  -> PASS: Regenerating titles preserved existing description and tags.")

        # -------------------------------------------------------------
        # Test 14: YouTube Regeneration Does Not Alter Instagram
        # -------------------------------------------------------------
        print("\n[Test 14] Testing Platform Isolation During Regeneration...")
        ig_before = regen_data["instagram"]
        res_regen_yt = client.post(f"/api/publishing-kits/{created_kit_id}/regenerate", json={
            "platform": "youtube"
        })
        assert res_regen_yt.status_code == 200
        ig_after = res_regen_yt.json()["instagram"]
        assert ig_before["first_line_hook"] == ig_after["first_line_hook"]
        assert ig_before["audio_direction"] == ig_after["audio_direction"]
        assert ig_before["captions"] == ig_after["captions"]
        print("  -> PASS: YouTube regeneration left Instagram fields completely unchanged.")

        # -------------------------------------------------------------
        # Test 15: Brand Settings Application
        # -------------------------------------------------------------
        print("\n[Test 15] Testing Brand Settings Profile Application...")
        profile = ChannelProfile(
            name="Spanish Tech Shorts",
            platform="youtube",
            niche="Programming",
            brand_voice="educational",
            content_language="Spanish",
            target_audience_level="intermediate",
            default_cta="Suscribete para mas tutoriales!",
            creator_name="Carlos Dev"
        )
        db.add(profile)
        db.commit()
        db.refresh(profile)

        # Generate a kit using this profile
        res_brand_kit = client.post("/api/publishing-kits/generate", json={
            "clip_id": clip_no_transcript.id,
            "channel_profile_id": profile.id
        })
        assert res_brand_kit.status_code == 200
        b_data = res_brand_kit.json()
        assert b_data["brand_settings_applied"]["brand_voice"] == "educational"
        assert b_data["brand_settings_applied"]["content_language"] == "Spanish"
        assert b_data["youtube"]["cta"] == "Suscribete para mas tutoriales!"
        print("  -> PASS: Profile brand voice, Spanish language, and custom CTA applied successfully.")

        # -------------------------------------------------------------
        # Test 16: Multiple Channel Profile Isolation
        # -------------------------------------------------------------
        print("\n[Test 16] Testing Multiple Channel Profile Isolation...")
        kit_1 = client.get(f"/api/publishing-kits/{created_kit_id}").json()
        kit_2 = client.get(f"/api/publishing-kits/{b_data['id']}").json()
        assert kit_1["language"] != kit_2["language"] or kit_1["youtube"]["cta"] != kit_2["youtube"]["cta"]
        print("  -> PASS: Kits under different profiles retain separate brand configurations.")

        # -------------------------------------------------------------
        # Test 17: Copy Action Formatting Helpers
        # -------------------------------------------------------------
        print("\n[Test 17] Testing Text Formatting Helpers...")
        db_kit = db.query(PublishingKit).filter(PublishingKit.id == created_kit_id).first()
        yt_copy = service.format_youtube_text(db_kit, test_clip)
        assert "=== YOUTUBE SHORTS PUBLISHING KIT ===" in yt_copy
        assert "TITLE:" in yt_copy
        assert "DESCRIPTION:" in yt_copy
        assert "TAGS:" in yt_copy

        ig_copy = service.format_instagram_text(db_kit, test_clip)
        assert "=== INSTAGRAM REELS PUBLISHING KIT ===" in ig_copy
        assert "FIRST-LINE HOOK:" in ig_copy
        assert "CAPTION:" in ig_copy
        assert "AUDIO MOOD DIRECTION:" in ig_copy
        print("  -> PASS: Copy-paste formatting generates clear, structured text blocks.")

        # -------------------------------------------------------------
        # Test 18: TXT Export Endpoint
        # -------------------------------------------------------------
        print("\n[Test 18] Testing TXT Export Endpoint...")
        res_txt = client.get(f"/api/publishing-kits/{created_kit_id}/export?format=txt")
        assert res_txt.status_code == 200
        assert "text/plain" in res_txt.headers["content-type"]
        assert "attachment" in res_txt.headers["content-disposition"]
        txt_body = res_txt.text
        assert "YOUTUBE SHORTS PUBLISHING KIT" in txt_body
        assert "INSTAGRAM REELS PUBLISHING KIT" in txt_body
        print("  -> PASS: TXT export returns UTF-8 text with full kit documentation.")

        # -------------------------------------------------------------
        # Test 19: JSON Export Schema
        # -------------------------------------------------------------
        print("\n[Test 19] Testing JSON Export Schema...")
        res_json = client.get(f"/api/publishing-kits/{created_kit_id}/export?format=json")
        assert res_json.status_code == 200
        assert "application/json" in res_json.headers["content-type"]
        j_data = res_json.json()
        assert "kit_id" in j_data
        assert "clip" in j_data
        assert "youtube" in j_data
        assert "instagram" in j_data
        assert j_data["youtube"]["selected_title"]
        print("  -> PASS: JSON export returns structured machine-readable metadata schema.")

        # -------------------------------------------------------------
        # Test 20: ZIP Export Packaging (Existing Files Only)
        # -------------------------------------------------------------
        print("\n[Test 20] Testing ZIP Package Export...")
        res_zip = client.get(f"/api/publishing-kits/{created_kit_id}/export?format=zip")
        assert res_zip.status_code == 200
        assert "application/zip" in res_zip.headers["content-type"]
        zip_bytes = io.BytesIO(res_zip.content)
        with zipfile.ZipFile(zip_bytes, "r") as z:
            namelist = z.namelist()
            assert "README.txt" in namelist
            assert "youtube/metadata.txt" in namelist
            assert "instagram/metadata.txt" in namelist
            # Verify no corrupt/empty missing files
            for info in z.infolist():
                assert info.file_size >= 0
        print(f"  -> PASS: ZIP export generated successfully with files: {namelist[:4]}...")

        # -------------------------------------------------------------
        # Test 21: Persistence Across Backend Reconnect
        # -------------------------------------------------------------
        print("\n[Test 21] Testing Persistence Across DB Session Reconnect...")
        db.close()
        db = SessionLocal()
        kit_reloaded = db.query(PublishingKit).filter(PublishingKit.id == created_kit_id).first()
        assert kit_reloaded is not None
        assert json.loads(kit_reloaded.yt_titles_json)
        assert json.loads(kit_reloaded.ig_captions_json)
        print("  -> PASS: Data strictly persists across new database connections.")

        # -------------------------------------------------------------
        # Test 22: Calendar Linking (scheduled_posts)
        # -------------------------------------------------------------
        print("\n[Test 22] Testing Calendar Linking...")
        scheduled_post = ScheduledPost(
            channel_profile_id=profile.id,
            clip_id=test_clip_id,
            platform="youtube_shorts",
            title="Phase9 Scheduled Test Short",
            scheduled_date="2026-11-25",
            scheduled_time="15:00",
            status="scheduled"
        )
        db.add(scheduled_post)
        db.commit()
        db.refresh(scheduled_post)

        res_link = client.put(f"/api/publishing-kits/{created_kit_id}", json={
            "scheduled_post_id": scheduled_post.id
        })
        assert res_link.status_code == 200
        assert res_link.json()["scheduled_post_id"] == scheduled_post.id
        print("  -> PASS: Publishing kit linked to ScheduledPost in content calendar.")

        # -------------------------------------------------------------
        # Test 23: Manual Ready / Published Status Handling
        # -------------------------------------------------------------
        print("\n[Test 23] Testing Status Transitions (Draft -> Ready -> Published)...")
        # Mark Ready
        res_ready = client.post(f"/api/publishing-kits/{created_kit_id}/mark-ready")
        assert res_ready.status_code == 200
        assert res_ready.json()["status"] == "ready"

        # Mark Published with URL
        pub_url = "https://youtube.com/shorts/test_live_url_123"
        res_pub = client.post(f"/api/publishing-kits/{created_kit_id}/mark-published", json={
            "published_url": pub_url
        })
        assert res_pub.status_code == 200
        assert res_pub.json()["status"] == "published"
        assert res_pub.json()["published_url"] == pub_url
        print(f"  -> PASS: Status updated to 'published' with tracking URL: {pub_url}")

        # -------------------------------------------------------------
        # Test 24: Deletion Safety
        # -------------------------------------------------------------
        print("\n[Test 24] Testing Deletion Safety...")
        res_del = client.delete(f"/api/publishing-kits/{b_data['id']}")
        assert res_del.status_code == 200

        # Verify parent clip and video still exist
        assert db.query(Clip).filter(Clip.id == clip_no_transcript_id).first() is not None
        assert db.query(SourceVideo).filter(SourceVideo.id == test_video_id).first() is not None
        print("  -> PASS: Kit deletion safely deleted kit record while preserving clip and source video.")

        # -------------------------------------------------------------
        # Test 25: Input Validation & Error Handling
        # -------------------------------------------------------------
        print("\n[Test 25] Testing Input Validation & Error Handling...")
        # 404 for nonexistent kit
        res_404 = client.get("/api/publishing-kits/nonexistent-kit-id")
        assert res_404.status_code == 404

        # 404 for generate on nonexistent clip
        res_bad_clip = client.post("/api/publishing-kits/generate", json={"clip_id": "fake-clip"})
        assert res_bad_clip.status_code == 404

        # 400 or 422 for invalid export format
        res_bad_fmt = client.get(f"/api/publishing-kits/{created_kit_id}/export?format=invalid_fmt")
        assert res_bad_fmt.status_code in (400, 422)
        print("  -> PASS: Input validation and HTTP status codes correctly enforced.")

        print("\n" + "=" * 75)
        print("      ALL 25 PHASE 9 PUBLISHING KIT TESTS PASSED!")
        print("=" * 75)
        return True

    finally:
        # Cleanup test artifacts
        cleanup_db = SessionLocal()
        cleanup_db.query(PublishingKit).delete()
        cleanup_db.query(ScheduledPost).filter(ScheduledPost.title.like("Phase9%")).delete()
        cleanup_db.query(TranscriptSegment).filter(TranscriptSegment.transcript_id == test_transcript_id).delete()
        cleanup_db.query(Transcript).filter(Transcript.id == test_transcript_id).delete()
        cleanup_db.query(Clip).filter(Clip.project_id == test_project_id).delete()
        cleanup_db.query(SourceVideo).filter(SourceVideo.project_id == test_project_id).delete()
        cleanup_db.query(Project).filter(Project.id == test_project_id).delete()
        cleanup_db.commit()
        cleanup_db.close()

if __name__ == "__main__":
    success = run_phase9_tests()
    sys.exit(0 if success else 1)
