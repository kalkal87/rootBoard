#!/usr/bin/env python3
"""Tests for framework_catalog.py.

Run with:
    python3 tests/python/test_framework_catalog.py
"""

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
import framework_catalog  # noqa: E402

FRAMEWORKS = str(SKILL_ROOT / "frameworks")
SCRIPT = str(SCRIPT_DIR / "framework_catalog.py")


class FrameworkCatalogTests(unittest.TestCase):

    def test_real_library_is_compact_and_complete(self):
        catalog = framework_catalog.build_catalog(FRAMEWORKS)
        self.assertEqual(len(catalog), 5)
        self.assertEqual(
            [item["slug"] for item in catalog],
            sorted(item["slug"] for item in catalog))
        for item in catalog:
            self.assertEqual(
                set(item),
                {"name", "slug", "good_for", "when_to_use", "blind_spot"})
            self.assertTrue(all(item.values()))
            self.assertNotIn("Reasoning steps", item["blind_spot"])

    def test_cli_emits_json_and_ignores_readme(self):
        result = subprocess.run(
            [sys.executable, SCRIPT, "--frameworks-dir", FRAMEWORKS],
            check=True, capture_output=True, text=True)
        payload = json.loads(result.stdout)
        self.assertEqual(len(payload["frameworks"]), 5)
        self.assertNotIn("README", [item["name"] for item in
                                    payload["frameworks"]])

    def test_missing_required_frontmatter_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = os.path.join(directory, "broken.md")
            with open(path, "w", encoding="utf-8") as handle:
                handle.write(
                    "---\nname: Broken\nslug: broken\n"
                    "good_for: Testing failures.\n---\n\n"
                    "# Broken\n\n## Known blind spot\nNone.\n")
            with self.assertRaisesRegex(ValueError, "when_to_use"):
                framework_catalog.build_catalog(directory)


if __name__ == "__main__":
    unittest.main()
