#!/usr/bin/env python3
"""Check rootBoard's standalone skill metadata and dual-host package surface."""

import os
from pathlib import Path
import re
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "skills" / "rootboard"


def read(*parts):
    with open(SKILL_ROOT.joinpath(*parts),
              "r", encoding="utf-8") as handle:
        return handle.read()


def quoted_yaml_value(document, key):
    match = re.search(r"^\s+%s:\s+\"([^\"]*)\"\s*$" % re.escape(key),
                      document, re.MULTILINE)
    if not match:
        raise AssertionError("missing quoted YAML value: %s" % key)
    return match.group(1)


class SkillPackageTests(unittest.TestCase):

    def test_skill_declares_runtime_compatibility(self):
        skill = read("SKILL.md")
        compatibility = re.search(
            r"(?m)^compatibility:\s*(.+)$", skill)
        self.assertIsNotNone(compatibility)
        self.assertIn("Python 3.9+", compatibility.group(1))
        self.assertIn("isolated subagents", compatibility.group(1))

    def test_openai_metadata_matches_the_skill(self):
        metadata = read("agents", "openai.yaml")
        self.assertEqual(quoted_yaml_value(metadata, "display_name"), "rootBoard")

        short_description = quoted_yaml_value(metadata, "short_description")
        self.assertGreaterEqual(len(short_description), 25)
        self.assertLessEqual(len(short_description), 64)

        default_prompt = quoted_yaml_value(metadata, "default_prompt")
        self.assertIn("$rootboard", default_prompt)
        self.assertRegex(metadata, r"(?m)^\s+allow_implicit_invocation:\s+true\s*$")

    def test_openai_metadata_assets_exist(self):
        metadata = read("agents", "openai.yaml")
        for key in ("icon_small", "icon_large"):
            relative_path = quoted_yaml_value(metadata, key)
            self.assertTrue(relative_path.startswith("./assets/"))
            asset_path = SKILL_ROOT / relative_path[2:]
            self.assertTrue(os.path.isfile(asset_path), asset_path)

    def test_primary_docs_cover_both_hosts(self):
        readme = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
        sharing = read("docs", "sharing.md")
        invocation = read("docs", "invocation-and-runs.md")
        for document in (readme, sharing, invocation):
            self.assertIn("Claude Code", document)
            self.assertIn("Codex", document)
        self.assertIn("$rootboard", sharing)
        self.assertIn("~/.agents/skills/rootboard/", sharing)
        self.assertIn("~/.claude/skills/rootboard/", sharing)

    def test_public_install_command_is_explicit(self):
        readme = (REPO_ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn(
            "npx skills add kalkal87/rootBoard --skill rootboard "
            "--global --agent codex",
            readme,
        )

    def test_public_tree_has_no_private_eval_stubs(self):
        for directory in [
                REPO_ROOT / "evals",
                REPO_ROOT / "examples" / "evaluation-cases"]:
            self.assertFalse(any(
                candidate.is_file() for candidate in directory.rglob("*")))
        for path in [REPO_ROOT / "README.md", SKILL_ROOT]:
            files = [path] if path.is_file() else path.rglob("*")
            for candidate in files:
                if candidate.is_file() and candidate.suffix in {".md", ".yaml"}:
                    with self.subTest(path=candidate):
                        self.assertNotRegex(
                            candidate.read_text(encoding="utf-8").lower(),
                            r"github\.com/[^/\s)]+/[^/\s)]*eval",
                        )

    def test_project_local_runs_are_gitignored(self):
        gitignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8")
        self.assertRegex(gitignore, r"(?m)^rootboard-runs/$")


if __name__ == "__main__":
    unittest.main()
