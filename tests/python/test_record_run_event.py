#!/usr/bin/env python3
"""Tests for record_run_event.py.

Run with:
    python3 tests/python/test_record_run_event.py
"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "skills" / "rootboard"
SCRIPT_DIR = SKILL_ROOT / "orchestration" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))
import new_run  # noqa: E402
import record_run_event  # noqa: E402

NOW = "2026-09-01T09:31:12-04:00"


class RecordRunEventTests(unittest.TestCase):

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.run = self.temporary.name
        self.status_path = os.path.join(self.run, "run-status.md")
        status = new_run.status_document(
            self.run, "2026-09-01T09:30:00-04:00", "test", "some input")
        with open(self.status_path, "w", encoding="utf-8") as handle:
            handle.write(status)

    def tearDown(self):
        self.temporary.cleanup()

    def test_records_a_known_event_without_changing_stage_rows(self):
        original_mode = os.stat(self.status_path).st_mode & 0o777
        record_run_event.record(
            self.run, "classification-started", NOW)
        with open(self.status_path, encoding="utf-8") as handle:
            status = handle.read()
        self.assertIn("| Classification started | %s |" % NOW, status)
        self.assertIn("| 3. Classification | pending | |", status)
        self.assertEqual(os.stat(self.status_path).st_mode & 0o777,
                         original_mode)

    def test_records_all_three_critical_path_events(self):
        for event in record_run_event.EVENTS:
            record_run_event.record(self.run, event, NOW)
        with open(self.status_path, encoding="utf-8") as handle:
            status = handle.read()
        for label in record_run_event.EVENTS.values():
            self.assertIn("| %s | %s |" % (label, NOW), status)

    def test_unknown_event_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "unknown run event"):
            record_run_event.record(self.run, "thinking-about-it", NOW)


if __name__ == "__main__":
    unittest.main()
