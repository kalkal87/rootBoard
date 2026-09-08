#!/usr/bin/env python3
"""Tests for profile_run_latency.py.

Run with:
    python3 tests/python/test_profile_run_latency.py
"""

import datetime
import json
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
import profile_run_latency  # noqa: E402


SCRIPT = str(SCRIPT_DIR / "profile_run_latency.py")
BASE = datetime.datetime(2026, 9, 1, 13, 30, tzinfo=datetime.timezone.utc)


class ProfileRunLatencyTests(unittest.TestCase):

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.run = self.temporary.name

    def tearDown(self):
        self.temporary.cleanup()

    def write_status(
        self,
        created="2026-09-01T09:30:00-04:00",
        dispatched="2026-09-01T09:30:09-04:00",
    ):
        status = """# Run Status

| Event | Timestamp |
| --- | --- |
| Run created | %s |
| Classification started | 2026-09-01T09:30:02-04:00 |
| Classification saved | 2026-09-01T09:30:08-04:00 |
| Agents dispatched | %s |
""" % (created, dispatched)
        with open(
            os.path.join(self.run, "run-status.md"), "w", encoding="utf-8"
        ) as handle:
            handle.write(status)

    def artifact(self, name, seconds, content=b"not parsed by the profiler"):
        path = os.path.join(self.run, name)
        with open(path, "wb") as handle:
            handle.write(content)
        stamp = BASE + datetime.timedelta(seconds=seconds)
        nanoseconds = int(stamp.timestamp() * 1_000_000_000)
        os.utime(path, ns=(nanoseconds, nanoseconds))
        return path

    def complete_run(self):
        self.write_status()
        self.artifact("input.md", 0)
        self.artifact("classification.md", 8)
        self.artifact("findings-five-whys.md", 20)
        self.artifact("findings-jobs-to-be-done.md", 25)
        self.artifact("synthesis.md", 37)
        self.artifact("board-data.json", 37.03, content=b"not json")
        self.artifact("whiteboard.html", 37.06, content=b"not html")

    def test_profiles_the_critical_path_without_reading_artifact_contents(self):
        self.complete_run()
        profile = profile_run_latency.collect(self.run)

        expected = {
            "pre_dispatch": 9,
            "classification": 6,
            "dispatch_handoff": 1,
            "parallel_agents": 16,
            "agent_completion_spread": 5,
            "handoff_and_synthesis": 12,
            "board_data_translation": 0.03,
            "whiteboard_assembly": 0.03,
            "total_to_whiteboard": 37.06,
        }
        for phase, seconds in expected.items():
            self.assertAlmostEqual(
                profile["phases_seconds"][phase], seconds, places=5, msg=phase
            )

        self.assertEqual(
            [agent["lens"] for agent in profile["agents"]],
            ["five-whys", "jobs-to-be-done"],
        )
        self.assertAlmostEqual(
            profile["agents"][0]["dispatch_to_save_seconds"], 11
        )
        self.assertAlmostEqual(
            profile["agents"][1]["dispatch_to_save_seconds"], 16
        )
        self.assertEqual(profile["warnings"], [])

    def test_partial_run_is_reported_without_writing_or_failing(self):
        self.write_status(dispatched="pending")
        input_path = self.artifact("input.md", 0)
        before = os.stat(input_path).st_mtime_ns

        profile = profile_run_latency.collect(self.run)

        self.assertIsNone(profile["phases_seconds"]["parallel_agents"])
        self.assertIsNone(profile["phases_seconds"]["total_to_whiteboard"])
        self.assertEqual(os.stat(input_path).st_mtime_ns, before)
        self.assertTrue(
            any("No findings-*.md" in warning for warning in profile["warnings"])
        )
        self.assertTrue(
            any("Agents dispatched" in warning for warning in profile["warnings"])
        )

    def test_json_cli_output_can_be_saved_without_changing_measured_artifacts(self):
        self.complete_run()
        before = {
            name: os.stat(os.path.join(self.run, name)).st_mtime_ns
            for name in os.listdir(self.run)
        }
        output_path = os.path.join(self.run, "latency.json")
        with open(output_path, "w", encoding="utf-8") as output:
            subprocess.run(
                [sys.executable, SCRIPT, self.run, "--json"],
                check=True,
                stdout=output,
                stderr=subprocess.PIPE,
                text=True,
            )
        with open(output_path, encoding="utf-8") as output:
            profile = json.load(output)
        self.assertEqual(profile["measurement"], "passive post-run file timestamps")
        self.assertEqual(
            profile["runtime_overhead"],
            "local profiling at run close; excluded from total_to_whiteboard",
        )
        self.assertAlmostEqual(profile["phases_seconds"]["parallel_agents"], 16)
        self.assertAlmostEqual(profile["phases_seconds"]["total_to_whiteboard"], 37.06)
        self.assertEqual(set(os.listdir(self.run)), set(before) | {"latency.json"})
        for name, timestamp in before.items():
            self.assertEqual(os.stat(os.path.join(self.run, name)).st_mtime_ns, timestamp)

    def test_rejects_a_directory_that_is_not_a_run(self):
        with self.assertRaisesRegex(
            profile_run_latency.ProfileError, "does not look"
        ):
            profile_run_latency.collect(self.run)

    def test_out_of_order_file_times_are_flagged_instead_of_reported(self):
        self.complete_run()
        self.artifact("board-data.json", 36)

        profile = profile_run_latency.collect(self.run)

        self.assertIsNone(profile["phases_seconds"]["board_data_translation"])
        self.assertTrue(
            any("out of order" in warning for warning in profile["warnings"])
        )


if __name__ == "__main__":
    unittest.main()
