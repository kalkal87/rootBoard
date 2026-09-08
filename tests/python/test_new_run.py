#!/usr/bin/env python3
"""Tests for new_run.py.

Run with:
    python3 tests/python/test_new_run.py
"""

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "skills" / "rootboard"
SCRIPT_DIR = SKILL_ROOT / "orchestration" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))
import check_run  # noqa: E402

SCRIPT = str(SCRIPT_DIR / "new_run.py")
NOW = "2026-09-01T09:30:00-04:00"


class NewRunTests(unittest.TestCase):

    def run_script(self, *args, input_bytes=None):
        return subprocess.run(
            [sys.executable, SCRIPT, *args], input=input_bytes,
            check=True, capture_output=True)

    def test_file_input_uses_filename_without_model_generated_slug(self):
        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, "Q3 Retro Notes.md")
            runs = os.path.join(directory, "runs")
            raw = b"first line\nsecond line\n"
            with open(source, "wb") as handle:
                handle.write(raw)

            result = self.run_script(
                "--from", source, "--runs-dir", runs, "--now", NOW)
            run = result.stdout.decode().strip()

            self.assertTrue(run.endswith("2026-09-01-0930-q3-retro-notes"))
            with open(os.path.join(run, "input.md"), "rb") as handle:
                self.assertEqual(handle.read(), raw)

    def test_pasted_input_defaults_to_run_slug_and_seeds_timing(self):
        with tempfile.TemporaryDirectory() as directory:
            result = self.run_script(
                "--runs-dir", directory, "--now", NOW,
                input_bytes=b"a pasted context dump")
            run = result.stdout.decode().strip()
            self.assertTrue(run.endswith("2026-09-01-0930-run"))

            with open(os.path.join(run, "run-status.md"),
                      encoding="utf-8") as handle:
                status = handle.read()
            self.assertIn("| Run created | 2026-09-01T09:30:00-04:00 |", status)
            self.assertIn("| Classification started | pending |", status)
            self.assertIn("| Classification saved | pending |", status)
            self.assertIn("| Agents dispatched | pending |", status)
            self.assertEqual(len(check_run.STATUS_ROW_RE.findall(status)), 7)

    def test_explicit_slug_remains_an_override(self):
        with tempfile.TemporaryDirectory() as directory:
            source = os.path.join(directory, "notes.md")
            runs = os.path.join(directory, "runs")
            with open(source, "w", encoding="utf-8") as handle:
                handle.write("notes")
            result = self.run_script(
                "--from", source, "--slug", "customer-churn",
                "--runs-dir", runs, "--now", NOW)
            self.assertTrue(result.stdout.decode().strip().endswith(
                "2026-09-01-0930-customer-churn"))


if __name__ == "__main__":
    unittest.main()
