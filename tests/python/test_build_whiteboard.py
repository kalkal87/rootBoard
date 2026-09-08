#!/usr/bin/env python3
"""Tests for the self-contained whiteboard artifact builder."""

import importlib.util
import json
from pathlib import Path
import re
import sys
import unittest


REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "skills" / "rootboard"
MODULE_PATH = SKILL_ROOT / "orchestration" / "scripts" / "build_whiteboard.py"


def load_build_whiteboard():
    """Load the neighboring script without leaking its import-time globals."""
    original_dont_write_bytecode = sys.dont_write_bytecode
    original_path = sys.path[:]
    try:
        spec = importlib.util.spec_from_file_location(
            "build_whiteboard_under_test", MODULE_PATH)
        if spec is None or spec.loader is None:
            raise ImportError("could not load %s" % MODULE_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module
    finally:
        sys.dont_write_bytecode = original_dont_write_bytecode
        sys.path[:] = original_path


build_whiteboard = load_build_whiteboard()


class BuildWhiteboardTests(unittest.TestCase):
    def setUp(self):
        self.board_data = {
            "board_title": "Builder test board",
            "generated_at": "2026-08-31T12:00:00Z",
            "source_summary": "A minimal valid board for builder tests.",
            "cards": [
                {
                    "id": "card-1",
                    "problem_statement": "The artifact must be portable.",
                    "impact": "External renderer assets would break when moved.",
                    "proof_points": [],
                    "frameworks": [{"name": "Systems Thinking"}],
                    "position": {"x": 0, "y": 0},
                    "convergence_note": "",
                    "created_by": "agent",
                    "tags": [],
                }
            ],
        }
        self.template = """<!doctype html>
<html>
  <head>
    <title>Problem Board</title>
    <link rel="stylesheet" href="../whiteboard/whiteboard.css" />
  </head>
  <body>
    <div id="board-root"></div>
    <script>
      window.BOARD_DATA = __BOARD_DATA__;
      window.SYNTHESIS_MARKDOWN = __SYNTHESIS_MARKDOWN__;
    </script>
    <script src="../whiteboard/whiteboard-core.js"></script>
    <script src="../whiteboard/whiteboard.js"></script>
    <script>
      ProblemBoard.mount(
        window.BOARD_DATA,
        document.getElementById("board-root"),
        { synthesisMarkdown: window.SYNTHESIS_MARKDOWN }
      );
    </script>
  </body>
</html>
"""

    def assertTemplateRejected(self, template, pattern, css="/* CSS_MARKER */"):
        with self.assertRaisesRegex(ValueError, pattern):
            build_whiteboard.build(
                self.board_data,
                template,
                css,
                "var CORE_MARKER = true;",
                "var RENDERER_MARKER = true;",
            )

    def test_loading_builder_preserves_python_import_globals(self):
        original_dont_write_bytecode = sys.dont_write_bytecode
        original_path = sys.path[:]

        load_build_whiteboard()

        self.assertEqual(original_dont_write_bytecode, sys.dont_write_bytecode)
        self.assertEqual(original_path, sys.path)

    def test_inlines_core_before_renderer_and_mount(self):
        result = build_whiteboard.build(
            self.board_data,
            self.template,
            "/* CSS_MARKER */",
            "var CORE_MARKER = true;",
            "var RENDERER_MARKER = true;",
        )

        self.assertNotIn(
            '<script src="../whiteboard/whiteboard-core.js"></script>', result)
        self.assertNotIn(
            '<script src="../whiteboard/whiteboard.js"></script>', result)
        self.assertNotIn(
            '<link rel="stylesheet" href="../whiteboard/whiteboard.css" />',
            result,
        )
        self.assertIn("<style>\n/* CSS_MARKER */\n    </style>", result)
        core = result.index("CORE_MARKER")
        renderer = result.index("RENDERER_MARKER")
        mount = result.index("ProblemBoard.mount")
        self.assertLess(core, renderer)
        self.assertLess(renderer, mount)

    def test_embeds_complete_synthesis_as_a_script_safe_string(self):
        synthesis = (
            "# Synthesis\n\nEvery line stays here.\n"
            "</script><script>window.bad = true;</script>\n"
            "Unicode evidence: café — 東京\n"
        )

        result = build_whiteboard.build(
            self.board_data,
            self.template,
            "/* CSS_MARKER */",
            "var CORE_MARKER = true;",
            "var RENDERER_MARKER = true;",
            synthesis,
        )

        match = re.search(
            r"window\.SYNTHESIS_MARKDOWN = (.*);", result)
        self.assertIsNotNone(match)
        self.assertEqual(json.loads(match.group(1)), synthesis)
        self.assertNotIn("<script>window.bad", result)
        self.assertNotIn(build_whiteboard.SYNTHESIS_PLACEHOLDER, result)

    def test_missing_synthesis_assignment_is_rejected(self):
        template = self.template.replace(
            "      window.SYNTHESIS_MARKDOWN = "
            "__SYNTHESIS_MARKDOWN__;\n",
            "",
        )

        self.assertTemplateRejected(template, r"(?i)synthesis.*assignment")

    def test_missing_core_script_tag_is_rejected(self):
        template = self.template.replace(
            '    <script src="../whiteboard/whiteboard-core.js"></script>\n', "")

        self.assertTemplateRejected(
            template, r"(?i)core.*(?:script|tag|asset)")

    def test_rejects_renderer_before_core(self):
        core = '    <script src="../whiteboard/whiteboard-core.js"></script>\n'
        renderer = '    <script src="../whiteboard/whiteboard.js"></script>\n'
        template = self.template.replace(core + renderer, renderer + core)

        self.assertTemplateRejected(template, r"(?i)(?:order|before)")

    def test_rejects_stylesheet_after_core(self):
        css = '    <link rel="stylesheet" href="../whiteboard/whiteboard.css" />\n'
        core = '    <script src="../whiteboard/whiteboard-core.js"></script>\n'
        template = self.template.replace(css, "").replace(core, core + css)

        self.assertTemplateRejected(template, r"(?i)(?:order|before)")

    def test_rejects_renderer_after_board_mount(self):
        renderer = '    <script src="../whiteboard/whiteboard.js"></script>\n'
        template = self.template.replace(renderer, "").replace(
            "  </body>", renderer + "  </body>")

        self.assertTemplateRejected(template, r"(?i)(?:mount|before|order)")

    def test_rejects_duplicate_core_tag_even_when_copy_is_commented(self):
        core = '<script src="../whiteboard/whiteboard-core.js"></script>'
        template = self.template.replace(
            "    " + core, "    <!-- %s -->\n    %s" % (core, core))

        self.assertTemplateRejected(
            template, r"(?i)core.*(?:exactly once|duplicate|one)")

    def test_rejects_duplicate_renderer_tag(self):
        renderer = '<script src="../whiteboard/whiteboard.js"></script>'
        template = self.template.replace(
            "    " + renderer, "    %s\n    %s" % (renderer, renderer))

        self.assertTemplateRejected(
            template, r"(?i)renderer.*(?:exactly once|duplicate|one)")

    def test_rejects_core_tag_found_only_inside_html_comment(self):
        core = '<script src="../whiteboard/whiteboard-core.js"></script>'
        template = self.template.replace(core, "<!-- %s -->" % core)

        self.assertTemplateRejected(
            template, r"(?i)core.*(?:comment|active|tag)")

    def test_css_content_cannot_supply_a_missing_core_tag(self):
        core = '<script src="../whiteboard/whiteboard-core.js"></script>'
        template = self.template.replace("    " + core + "\n", "")

        self.assertTemplateRejected(
            template,
            r"(?i)core.*(?:script|tag|asset)",
            css="/* %s */" % core,
        )

    def test_rejects_asset_content_that_leaves_an_external_script_tag(self):
        core = '<script src="../whiteboard/whiteboard-core.js"></script>'

        self.assertTemplateRejected(
            self.template,
            r"(?i)external.*core.*(?:remain|inline)",
            css="/* %s */" % core,
        )

    def test_escapes_core_and_renderer_javascript_for_inline_scripts(self):
        core_js = 'var CORE_ESCAPE = "</ScRiPt>";'
        renderer_js = 'var RENDERER_ESCAPE = "</SCRIPT>";'
        result = build_whiteboard.build(
            self.board_data,
            self.template,
            "/* CSS_MARKER */",
            core_js,
            renderer_js,
        )

        self.assertIn(r'<\/ScRiPt>', result)
        self.assertIn(r'<\/SCRIPT>', result)
        self.assertNotIn("</ScRiPt>", result)
        self.assertNotIn("</SCRIPT>", result)
        for source in (core_js, renderer_js):
            escaped = build_whiteboard.escape_js_for_inline(source)
            self.assertIsNone(re.search(r"</script", escaped, re.IGNORECASE))


if __name__ == "__main__":
    unittest.main()
