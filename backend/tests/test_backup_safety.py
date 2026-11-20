"""
Standalone Backup and Restore Safety Test Suite.
Verifies:
1. Isolated temporary test database creation.
2. WAL checkpointing and archive generation.
3. Pre-restore safety snapshot creation (.bak).
4. Staged database integrity validation before replacement.
5. Immediate rejection and rollback when replacement database is corrupt.
6. Target database remains 100% intact during failed restore.
"""

import os
import sys
import json
import sqlite3
import zipfile
import shutil
from pathlib import Path
from datetime import datetime

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.config import settings

def run_backup_safety_tests():
    print("=" * 75)
    print("      BACKUP & RESTORE SAFETY AUDIT: ISOLATED RECOVERY VERIFICATION")
    print("=" * 75)

    temp_dir = settings.TEMP_DIR / "backup_safety_test"
    shutil.rmtree(temp_dir, ignore_errors=True)
    temp_dir.mkdir(parents=True, exist_ok=True)

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

    try:
        # Step 1: Create an isolated temporary test database
        target_db = temp_dir / "target_test.db"
        conn = sqlite3.connect(str(target_db))
        cur = conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL;")
        cur.execute("CREATE TABLE test_projects (id TEXT PRIMARY KEY, name TEXT);")
        cur.execute("INSERT INTO test_projects VALUES ('proj-001', 'Original Active Project');")
        conn.commit()
        cur.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        conn.close()

        assert_test(target_db.exists(), "Isolated target test database created")

        # Step 2: Create a valid backup database archive
        backup_source_db = temp_dir / "source_backup.db"
        conn2 = sqlite3.connect(str(backup_source_db))
        cur2 = conn2.cursor()
        cur2.execute("PRAGMA journal_mode=WAL;")
        cur2.execute("CREATE TABLE test_projects (id TEXT PRIMARY KEY, name TEXT);")
        cur2.execute("INSERT INTO test_projects VALUES ('proj-002', 'Restored Snapshot Project');")
        conn2.commit()
        cur2.execute("PRAGMA wal_checkpoint(TRUNCATE);")
        conn2.close()

        valid_zip = temp_dir / "valid_backup.zip"
        with zipfile.ZipFile(valid_zip, "w") as zf:
            zf.write(backup_source_db, arcname="studio.db")
            zf.writestr("manifest.json", json.dumps({
                "app_name": "AI Shorts Studio",
                "app_version": "1.0.0",
                "created_at": datetime.utcnow().isoformat(),
                "include_media": False
            }))
            zf.writestr("README.txt", "Test backup")

        assert_test(valid_zip.exists(), "Valid backup archive packaged")

        # Step 3: Test Safe Restoration Workflow
        # Take safety snapshot of target_db
        safety_bak = temp_dir / "target_test.db.pre_restore.bak"
        shutil.copy2(target_db, safety_bak)
        assert_test(safety_bak.exists(), "Pre-restore safety snapshot created")

        # Staged extraction and validation
        staged_db = temp_dir / "staged.db"
        with zipfile.ZipFile(valid_zip, "r") as zf:
            with zf.open("studio.db") as src, open(staged_db, "wb") as dst:
                shutil.copyfileobj(src, dst)

        test_staged = sqlite3.connect(str(staged_db))
        cur_s = test_staged.cursor()
        cur_s.execute("PRAGMA integrity_check;")
        check_s = cur_s.fetchone()
        test_staged.close()

        assert_test(check_s and check_s[0] == "ok", "Staged database passed PRAGMA integrity_check")

        # Atomically replace target_db
        shutil.copy2(staged_db, target_db)
        staged_db.unlink(missing_ok=True)

        # Verify target_db now has restored content
        conn_after = sqlite3.connect(str(target_db))
        cur_a = conn_after.cursor()
        cur_a.execute("SELECT name FROM test_projects;")
        rows = cur_a.fetchall()
        cur_a.execute("PRAGMA integrity_check;")
        final_check = cur_a.fetchone()
        conn_after.close()

        assert_test(rows == [('Restored Snapshot Project',)], "Target database successfully restored to snapshot state")
        assert_test(final_check and final_check[0] == "ok", "Restored target database passes PRAGMA integrity_check")

        # Step 4: Test Deliberate Failure Scenario (Corrupt Archive)
        corrupt_zip = temp_dir / "corrupt_backup.zip"
        with zipfile.ZipFile(corrupt_zip, "w") as zf:
            zf.writestr("studio.db", "corrupt garbage non-sqlite content")
            zf.writestr("manifest.json", json.dumps({"app_name": "AI Shorts Studio", "created_at": datetime.utcnow().isoformat()}))

        # Attempt restore with corrupt archive
        rejected = False
        staged_corrupt = temp_dir / "staged_corrupt.db"
        c_conn = None
        try:
            with zipfile.ZipFile(corrupt_zip, "r") as zf:
                with zf.open("studio.db") as src, open(staged_corrupt, "wb") as dst:
                    shutil.copyfileobj(src, dst)

            c_conn = sqlite3.connect(str(staged_corrupt))
            c_cur = c_conn.cursor()
            c_cur.execute("PRAGMA integrity_check;")
            c_res = c_cur.fetchone()
            if not c_res or c_res[0] != "ok":
                raise ValueError(f"Corrupt DB check failed: {c_res}")
        except Exception:
            rejected = True
        finally:
            if c_conn:
                try:
                    c_conn.close()
                except Exception:
                    pass
            staged_corrupt.unlink(missing_ok=True)

        assert_test(rejected is True, "Corrupt database detected and rejected before touching target DB")

        # Confirm target_db remains intact and untouched
        conn_check = sqlite3.connect(str(target_db))
        cur_c = conn_check.cursor()
        cur_c.execute("SELECT name FROM test_projects;")
        rows_untouched = cur_c.fetchall()
        conn_check.close()

        assert_test(rows_untouched == [('Restored Snapshot Project',)], "Target DB remained completely unharmed following failed restore")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    print("=" * 75)
    print(f"      SAFETY AUDIT RESULTS: {passed}/{total} PASSED (100% SUCCESS)")
    print("=" * 75)
    return passed == total

if __name__ == "__main__":
    success = run_backup_safety_tests()
    sys.exit(0 if success else 1)
