import unittest
import os
from pathlib import Path
from app.services.ai_editor_service import ai_editor_service

class TestAIEditorService(unittest.TestCase):
    def setUp(self):
        self.service = ai_editor_service

    def test_enhance_video_quality_command(self):
        res = self.service.process_command("enhance the video quality")
        self.assertTrue(res["success"])
        self.assertTrue(res["config"]["enhance_quality"])
        self.assertIn("Enhanced video quality", res["actions"][0])

    def test_hindi_calligraphy_shivaji_command(self):
        res = self.service.process_command("add caligraphy in hindi of text shivaji")
        self.assertTrue(res["success"])
        calligraphy = res["config"].get("calligraphy", {})
        self.assertTrue(calligraphy.get("enabled"))
        self.assertEqual(calligraphy.get("text"), "॥ छत्रपती शिवाजी ॥")
        self.assertEqual(calligraphy.get("script"), "devanagari")

    def test_custom_calligraphy_command(self):
        res = self.service.process_command("add calligraphy of text 'जय भवानी'")
        self.assertTrue(res["success"])
        calligraphy = res["config"].get("calligraphy", {})
        self.assertTrue(calligraphy.get("enabled"))
        self.assertEqual(calligraphy.get("text"), "जय भवानी")

    def test_aspect_ratio_command(self):
        res = self.service.process_command("convert to 9:16 vertical reel")
        self.assertTrue(res["success"])
        self.assertEqual(res["config"]["aspect_ratio"], "9:16")

    def test_cinematic_color_grade_command(self):
        res = self.service.process_command("apply cinematic color grade")
        self.assertTrue(res["success"])
        self.assertEqual(res["config"]["color_grade"], "cinematic")

    def test_remove_calligraphy_command(self):
        cfg = {"calligraphy": {"enabled": True, "text": "॥ छत्रपती शिवाजी ॥"}}
        res = self.service.process_command("remove the calligraphy", current_config=cfg)
        self.assertTrue(res["success"])
        self.assertFalse(res["config"]["calligraphy"]["enabled"])

    def test_generate_calligraphy_overlay_png(self):
        calligraphy_cfg = {
            "enabled": True,
            "text": "॥ छत्रपती शिवाजी ॥",
            "subtitle": "जय भवानी • जय शिवाजी",
            "position": "top"
        }
        test_out = "D:/AI-Shorts-Studio/storage/temp/test_calligraphy.png"
        try:
            out = self.service.generate_calligraphy_overlay_png(calligraphy_cfg, test_out, 1080, 1920)
            self.assertTrue(os.path.exists(out))
            self.assertGreater(os.path.getsize(out), 500)
        finally:
            if os.path.exists(test_out):
                try:
                    os.remove(test_out)
                except Exception:
                    pass

if __name__ == "__main__":
    unittest.main()
