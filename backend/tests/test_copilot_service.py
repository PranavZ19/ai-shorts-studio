import unittest
from unittest.mock import MagicMock
import json

from app.services.copilot_service import CopilotService
from app.models.clip import Clip


class TestCopilotService(unittest.TestCase):
    def setUp(self):
        self.copilot = CopilotService()
        self.db = MagicMock()

    def _create_mock_clip(self, title="Test Clip", hook_summary="Amazing secret reveal"):
        clip = MagicMock(spec=Clip)
        clip.id = "test-clip-id"
        clip.video_id = "test-video-id"
        clip.start_time = 10.0
        clip.end_time = 40.0
        clip.title = title
        clip.hook_summary = hook_summary
        clip.edit_config_json = json.dumps({
            "aspect_ratio": "9:16",
            "framing": "center",
            "font_size": 28,
            "highlight_color": "#00FF88",
            "text_color": "#FFFFFF",
            "position_y": 72.0,
            "excluded_phrases": []
        })
        return clip

    def test_extract_target_text_quoted(self):
        prompt = 'I don\'t want the text on the screen which is "vagera nikalta hai"'
        extracted = self.copilot._extract_target_text(prompt)
        self.assertEqual(extracted, "vagera nikalta hai")

    def test_extract_target_text_unquoted_which_is(self):
        prompt = 'I dont want the text on the screen which is vagera nikalta hai'
        extracted = self.copilot._extract_target_text(prompt)
        self.assertEqual(extracted, "vagera nikalta hai")

    def test_extract_target_text_remove_prefix(self):
        prompt = 'remove shut up and stop the engine'
        extracted = self.copilot._extract_target_text(prompt)
        self.assertEqual(extracted, "shut up and stop the engine")

    def test_extract_target_text_hindi_nikal_do(self):
        prompt = 'screen se yeh text nikal do vagera nikalta hai'
        extracted = self.copilot._extract_target_text(prompt)
        self.assertEqual(extracted, "vagera nikalta hai")

    def test_process_command_remove_text(self):
        clip = self._create_mock_clip(hook_summary="vagera nikalta hai and more")
        res = self.copilot.process_command(clip, "I dont want the text on the screen which is vagera nikalta hai", self.db)
        self.assertTrue(res["success"])
        self.assertIn("vagera nikalta hai", res["edit_config"]["excluded_phrases"])
        self.assertIn("Removed 'vagera nikalta hai' from on-screen captions", res["actions"])

    def test_process_command_change_color(self):
        clip = self._create_mock_clip()
        res = self.copilot.process_command(clip, "Change highlight color to yellow", self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["edit_config"]["highlight_color"], "#FFCC00")

    def test_process_command_change_font_size(self):
        clip = self._create_mock_clip()
        res = self.copilot.process_command(clip, "Make font size 32", self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["edit_config"]["font_size"], 32)

    def test_process_command_switch_face_tracking(self):
        clip = self._create_mock_clip()
        res = self.copilot.process_command(clip, "Switch framing to AI face tracking", self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["edit_config"]["framing"], "auto_face")

    def test_process_command_move_caption_bottom(self):
        clip = self._create_mock_clip()
        res = self.copilot.process_command(clip, "Move caption position to bottom", self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["edit_config"]["position_y"], 82.0)

    def test_process_command_restore_phrase(self):
        clip = self._create_mock_clip()
        # First exclude
        self.copilot.process_command(clip, "remove 'vagera nikalta hai'", self.db)
        self.copilot.process_command(clip, "remove 'another phrase'", self.db)
        # Restore one phrase
        res = self.copilot.process_command(clip, "restore phrase 'vagera nikalta hai'", self.db)
        self.assertTrue(res["success"])
        self.assertNotIn("vagera nikalta hai", res["edit_config"]["excluded_phrases"])
        self.assertIn("another phrase", res["edit_config"]["excluded_phrases"])

    def test_process_command_clear_all_excluded(self):
        clip = self._create_mock_clip()
        self.copilot.process_command(clip, "remove 'phrase one'", self.db)
        res = self.copilot.process_command(clip, "clear all excluded phrases", self.db)
        self.assertTrue(res["success"])
        self.assertEqual(res["edit_config"]["excluded_phrases"], [])

    def test_process_command_remove_white_and_yellow_text(self):
        clip = self._create_mock_clip()
        res = self.copilot.process_command(clip, "I want to remove the text in white and yellow", self.db)
        self.assertTrue(res["success"])
        self.assertFalse(res["edit_config"]["caption_enabled"])
        self.assertIn("Removed white and yellow text overlay from the screen", res["actions"])

    def test_process_command_remove_till_bro_why(self):
        clip = self._create_mock_clip()
        res = self.copilot.process_command(clip, "I don't want the text on the screen which is that's enough why? etc till bro why?", self.db)
        self.assertTrue(res["success"])
        self.assertFalse(res["edit_config"]["caption_enabled"])


if __name__ == "__main__":
    unittest.main()
