"""
Phase 10 Automated Test Suite: Final Product Polish, Storage Management, Backup/Restore & Release Readiness.
Verifies all Phase 10 capabilities:
- Storage stats calculation across all categories on D:\AI-Shorts-Studio
- Safe cleanup of temporary upload chunks & intermediates
- Studio Backup generation with SQLite WAL checkpoint, manifest, and archive validation
- Archive integrity check via PRAGMA integrity_check
- Disaster recovery restoration with safety rollback .bak generation
- Indic/Devanagari font stacks in caption_service
- SQLite database integrity check
"""

import os
import sys
import json
import sqlite3
import zipfile
import shutil
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.services.backup_service import BackupService
from app.services.caption_service import CaptionService
from app.models.project import Project

client = TestClient(app)

def run_phase10_tests():
    print("=" * 80)
    print("      PHASE 10 AUTOMATED TEST SUITE: POLISH, STORAGE, BACKUP & RECOVERY")
    print("=" * 80)

    db = SessionLocal()
    passed = 0
    total = 0

    def assert_test(cond, name, details=""):
        nonlocal passed, total
        total += 1
        if cond:
            passed += 1
            print(f"  [PASS] Test {total:02d}: {name}")
        else:
            print(f"  [FAIL] Test {total:02d}: {name} - {details}")
            assert False, f"{name}: {details}"

    # -------------------------------------------------------------
    # 1. Storage Diagnostics & Cleanup
    # -------------------------------------------------------------
    print("\n--- [Section 1: Storage Diagnostics & Disk Breakdown] ---")

    res = client.get("/api/settings/storage-stats")
    assert_test(res.status_code == 200, "GET /api/settings/storage-stats returns 200")
    data = res.json()

    assert_test("storage_root" in data and "D:" in data["storage_root"], "storage_root points to D: drive")
    assert_test("total_studio_bytes" in data and data["total_studio_bytes"] >= 0, "total_studio_bytes reported")
    assert_test("breakdown" in data, "breakdown object present in response")

    breakdown = data.get("breakdown", {})
    required_keys = ["source_videos_bytes", "clips_bytes", "models_bytes", "temp_bytes", "thumbnails_bytes", "exports_bytes", "database_bytes"]
    assert_test(all(k in breakdown for k in required_keys), "all storage breakdown keys present", str(breakdown))

    disk = data.get("disk", {})
    assert_test(disk.get("total_gb", 0) > 0 and disk.get("free_gb", 0) > 0, f"disk metrics valid (Total: {disk.get('total_gb')}GB, Free: {disk.get('free_gb')}GB)")
    assert_test("is_low_space_warning" in data, "is_low_space_warning flag present")

    # -------------------------------------------------------------
    # 2. Temporary Files Safe Cleanup
    # -------------------------------------------------------------
    print("\n--- [Section 2: Temporary Files Safe Cleanup] ---")

    temp_chunks_dir = settings.TEMP_DIR / "upload_chunks"
    temp_chunks_dir.mkdir(parents=True, exist_ok=True)
    dummy_chunk = temp_chunks_dir / "p10_dummy_upload_chunk.tmp"
    dummy_chunk.write_text("dummy temporary chunk content for phase 10 cleanup test")
    assert_test(dummy_chunk.exists(), "dummy chunk created for cleanup test")

    res_clean = client.post("/api/settings/cleanup-temp")
    assert_test(res_clean.status_code == 200, "POST /api/settings/cleanup-temp returns 200")
    clean_data = res_clean.json()
    assert_test(clean_data.get("success") is True, "cleanup reported success")
    assert_test(clean_data.get("cleaned_count", 0) >= 1, f"cleaned_count >= 1 (got {clean_data.get('cleaned_count')})")
    assert_test(not dummy_chunk.exists(), "stale dummy chunk was removed from temp")
    assert_test(temp_chunks_dir.exists(), "upload_chunks directory recreated/preserved")

    # -------------------------------------------------------------
    # 3. Backup Creation & Manifest Structure
    # -------------------------------------------------------------
    print("\n--- [Section 3: Studio Backup Archive Generation] ---")

    backup_service = BackupService(db)
    backup_result = backup_service.create_backup(include_media=False, notes="Phase 10 Automated Audit Backup")
    assert_test(backup_result.get("success") is True, "BackupService.create_backup succeeded")
    backup_filename = backup_result.get("filename", "")
    assert_test(backup_filename.startswith("backup_") and backup_filename.endswith(".zip"), f"valid backup filename: {backup_filename}")

    backup_path = Path(backup_result.get("filepath", ""))
    assert_test(backup_path.exists() and backup_path.stat().st_size > 0, "backup ZIP archive exists on disk")

    # Inspect zip structure
    with zipfile.ZipFile(backup_path, "r") as zf:
        namelist = zf.namelist()
        assert_test("studio.db" in namelist, "studio.db present in archive")
        assert_test("manifest.json" in namelist, "manifest.json present in archive")
        assert_test("README.txt" in namelist, "README.txt present in archive")

        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert_test(manifest.get("app_name") == "AI Shorts Studio", "manifest app_name matches")
        assert_test(manifest.get("notes") == "Phase 10 Automated Audit Backup", "manifest notes preserved")
        assert_test("stats" in manifest, "manifest contains studio item stats breakdown")

    # -------------------------------------------------------------
    # 4. Backup List, Validation & Corrupted Handling
    # -------------------------------------------------------------
    print("\n--- [Section 4: Backup Listing & Archive Validation] ---")

    backups = backup_service.list_backups()
    assert_test(len(backups) >= 1, f"list_backups returned {len(backups)} backups")
    assert_test(any(b["filename"] == backup_filename for b in backups), "created backup found in list")

    val_valid = backup_service.validate_backup(backup_filename)
    assert_test(val_valid.get("valid") is True, "validate_backup confirms archive is valid and DB intact")
    assert_test(val_valid.get("filename") == backup_filename, "validated filename matches")

    # Test corrupted archive validation
    corrupt_name = "backup_test_corrupt_phase10.zip"
    corrupt_path = backup_service.backups_dir / corrupt_name
    with zipfile.ZipFile(corrupt_path, "w") as zf:
        zf.writestr("corrupt_dummy.txt", "not a valid backup")

    try:
        val_corrupt = backup_service.validate_backup(corrupt_name)
        assert_test(val_corrupt.get("valid") is False, "validate_backup correctly rejects corrupt archive")
        assert_test("Missing" in val_corrupt.get("error", ""), f"error specifies missing files: {val_corrupt.get('error')}")
    finally:
        corrupt_path.unlink(missing_ok=True)

    # -------------------------------------------------------------
    # 5. Safety Rollback & Restore Verification
    # -------------------------------------------------------------
    print("\n--- [Section 5: Database Disaster Recovery & Safety Rollback] ---")

    # 1. Create a canary project
    canary = Project(name="Phase 10 Canary Restore Project", description="Used to verify pre-restore state")
    db.add(canary)
    db.commit()
    canary_id = canary.id

    # 2. Take a checkpoint backup
    checkpoint = backup_service.create_backup(include_media=False, notes="Canary checkpoint")
    checkpoint_file = checkpoint["filename"]

    # 3. Delete canary from active DB
    db.delete(canary)
    db.commit()
    deleted_check = db.query(Project).filter(Project.id == canary_id).first()
    assert_test(deleted_check is None, "canary project deleted from database")

    # 4. Restore checkpoint
    restore_res = backup_service.restore_backup(checkpoint_file)
    assert_test(restore_res.get("success") is True, "restore_backup succeeded")
    pre_bak_path = Path(restore_res.get("pre_restore_backup", ""))
    assert_test(pre_bak_path.exists(), f"safety .bak created before restore: {pre_bak_path.name}")

    # 5. Check canary is restored
    db_after = SessionLocal()
    try:
        restored_canary = db_after.query(Project).filter(Project.id == canary_id).first()
        assert_test(restored_canary is not None, "canary project successfully restored in database")
        assert_test(restored_canary.name == "Phase 10 Canary Restore Project", "restored project properties match")

        # Cleanup canary
        db_after.delete(restored_canary)
        db_after.commit()
    finally:
        db_after.close()
        pre_bak_path.unlink(missing_ok=True)

    # -------------------------------------------------------------
    # 6. API Endpoints Integration (HTTP)
    # -------------------------------------------------------------
    print("\n--- [Section 6: Backup & Storage HTTP API Endpoints] ---")

    api_backups = client.get("/api/settings/backups")
    assert_test(api_backups.status_code == 200, "GET /api/settings/backups returns 200")
    assert_test(isinstance(api_backups.json(), list), "GET /api/settings/backups returns array")

    api_val = client.post("/api/settings/validate-backup", json={"filename": backup_filename, "confirm": False})
    assert_test(api_val.status_code == 200 and api_val.json().get("valid") is True, "POST /api/settings/validate-backup returns valid: true")

    api_dl = client.get(f"/api/settings/backups/{backup_filename}/download")
    assert_test(api_dl.status_code == 200, f"GET /api/settings/backups/{backup_filename}/download returns 200")
    assert_test(api_dl.headers.get("content-type") == "application/zip", "download response has application/zip content-type")

    unconfirmed_res = client.post("/api/settings/restore", json={"filename": backup_filename, "confirm": False})
    assert_test(unconfirmed_res.status_code == 400, "unconfirmed restore request correctly returns 400")

    # -------------------------------------------------------------
    # 7. Multilingual Indic Font Stack
    # -------------------------------------------------------------
    print("\n--- [Section 7: Multilingual Indic Font Stack & ASS Subtitles] ---")

    caption_svc = CaptionService()
    presets = caption_svc.get_presets()
    assert_test(len(presets) >= 5, f"presets dictionary contains {len(presets)} presets")

    bold_preset = presets.get("bold_creator", {})
    font_str = bold_preset.get("font_name", "")
    assert_test("Nirmala UI" in font_str or "Kohinoor Devanagari" in font_str or "Segoe UI" in font_str, f"Devanagari font present in font stack: {font_str}")

    sample_words = [
        {"word": "नमस्ते", "start": 0.0, "end": 0.5, "probability": 0.99},
        {"word": "दुनिया", "start": 0.5, "end": 1.0, "probability": 0.98},
        {"word": "Shorts", "start": 1.0, "end": 1.5, "probability": 0.95}
    ]
    temp_ass_path = settings.TEMP_DIR / "test_indic_subtitles.ass"
    caption_svc.generate_ass_subtitle(sample_words, temp_ass_path, preset_name="bold_creator")
    ass_text = temp_ass_path.read_text(encoding="utf-8")
    assert_test("नमस्ते" in ass_text and "दुनिया" in ass_text, "Devanagari UTF-8 characters properly rendered in ASS file")
    temp_ass_path.unlink(missing_ok=True)

    # -------------------------------------------------------------
    # 8. SQLite WAL Check & Database Integrity
    # -------------------------------------------------------------
    print("\n--- [Section 8: SQLite Database Integrity Check] ---")

    conn = sqlite3.connect(str(settings.DATABASE_PATH))
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA integrity_check;")
        res_integrity = cur.fetchone()
        assert_test(res_integrity is not None and res_integrity[0] == "ok", f"PRAGMA integrity_check result: {res_integrity[0]}")
    finally:
        conn.close()

    print("\n" + "=" * 80)
    print(f"      PHASE 10 TEST RESULTS: {passed}/{total} PASSED (100% SUCCESS)")
    print("=" * 80)
    return passed == total

if __name__ == "__main__":
    success = run_phase10_tests()
    sys.exit(0 if success else 1)
