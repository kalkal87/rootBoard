#!/usr/bin/env python3
"""Tests for translate_board_data.py.

Two fixtures are the repository's own maintained worked examples --
examples/synthesizer/scenario-strong/synthesis.md and
scenario-uncertain/synthesis.md -- as described in
examples/synthesizer/README.md. They are not just convenient sample data: if a
future edit to prompts/synthesizer.md or
contracts/synthesis-output.md changes the shape those examples use, this
should fail here rather than on a real run. A third fixture is an inline,
invented snippet built specifically to exercise shapes the two real
examples don't: a four-framework stack, an en dash and a plain hyphen as
the Frameworks separator, and a proof point whose own text contains a
semicolon. It is not derived from any real transcript.

Run with:
    python3 tests/python/test_translate_board_data.py
"""

import json
import os
import sys
import tempfile
import unittest
from unittest import mock
from pathlib import Path

sys.dont_write_bytecode = True
REPO_ROOT = Path(__file__).resolve().parents[2]
SKILL_ROOT = REPO_ROOT / "skills" / "rootboard"
SCRIPT_DIR = SKILL_ROOT / "orchestration" / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))
import translate_board_data as tbd  # noqa: E402
import validate_board_data as validator  # noqa: E402

EXAMPLES = str(SKILL_ROOT / "examples" / "synthesizer")


def read(*parts):
    with open(os.path.join(*parts), "r", encoding="utf-8") as handle:
        return handle.read()


SYNTHETIC_SYNTHESIS = """# Synthesis

## Reframed Problem Statement(s)

**A stack card and separator variants, for the parser's own test.**

## Structured Board Content

### First card, four contributing lenses
- **Problem Statement:** Widgets jam the hopper because the feed rate
  outpaces the sorter, a fact established across several long lines that
  wrap purely for source-file readability and must be read as one flowing
  sentence once joined back together by the parser under test.
- **Impact:** Line stoppages roughly twice a shift, each costing about
  fifteen minutes of restart time, according to the floor log.
- **Proof Points:**
  - "The sorter can't keep up once the feed goes above forty a minute."
    (Line lead, shift log 4)
  - "We had two jams today; same as most days." (Line lead, shift log 4);
    semicolon inside one bullet's own text, not a delimiter.
- **Frameworks:**
  - Five Whys — see top-level proof points.
  - Lean Wastes – "Waiting: 15 min average restart, twice a shift." (floor
    log)
  - Fishbone Analysis - "Mechanical: sorter belt is the older of the two
    lines." (maintenance log); "Process: feed rate was raised last quarter
    without a matching sorter upgrade." (planning notes)
  - Jobs to Be Done — "The line lead just wants a shift with zero jams, not
    a faster sorter per se." (interview, ~12:00)
- **Convergence Note:** Confidence: Five Whys Medium; Lean Wastes High;
  Fishbone Analysis High; Jobs to Be Done Medium. Strong convergence across
  all four assigned lenses.

### Second card, single lens
- **Problem Statement:** A lone, low-confidence lead with nothing else to
  corroborate it yet.
- **Impact:** Unclear -- one mention only.
- **Proof Points:**
  - "Someone mentioned the vendor might be switching suppliers." (aside,
    unclear source)
- **Frameworks:**
  - Jobs to Be Done — see top-level proof points
- **Convergence Note:** Confidence: Jobs to Be Done Low. No convergence.

## Coverage Note
Synthetic fixture; not a real run.
"""

MALFORMED_NO_SEPARATOR = """# Synthesis

## Structured Board Content

### Bad card
- **Problem Statement:** Something.
- **Impact:** Something else.
- **Proof Points:**
  - "a quote" (source)
- **Frameworks:**
  - Five Whys with no separator at all
- **Convergence Note:** Confidence: Five Whys Low.

## Coverage Note
"""

EMPTY_STATEMENT = """# Synthesis

## Structured Board Content

### Bad card
- **Problem Statement:**
- **Impact:** Something.
- **Proof Points:**
  - "a quote" (source)
- **Frameworks:**
  - Five Whys — see top-level proof points
- **Convergence Note:** Confidence: Five Whys Low.

## Coverage Note
"""

EMPTY_PROOF_POINTS = """# Synthesis

## Structured Board Content

### Bad card
- **Problem Statement:** Something.
- **Impact:** Something else.
- **Proof Points:**
- **Frameworks:**
  - Five Whys — see top-level proof points
- **Convergence Note:** Confidence: Five Whys Low.

## Coverage Note
"""

EMPTY_FRAMEWORKS = """# Synthesis

## Structured Board Content

### Bad card
- **Problem Statement:** Something.
- **Impact:** Something else.
- **Proof Points:**
  - "a quote" (source)
- **Frameworks:**
- **Convergence Note:** Confidence: Five Whys Low.

## Coverage Note
"""

EMPTY_CONVERGENCE_NOTE = """# Synthesis

## Structured Board Content

### Bad card
- **Problem Statement:** Something.
- **Impact:** Something else.
- **Proof Points:**
  - "a quote" (source)
- **Frameworks:**
  - Five Whys — see top-level proof points
- **Convergence Note:**

## Coverage Note
"""

NO_SECTION = """# Synthesis

## Coverage Note
No Structured Board Content heading anywhere in this document.
"""


class RealExampleTests(unittest.TestCase):
    """Parse the repository's own owner-approved worked examples."""

    def test_scenario_strong(self):
        text = read(EXAMPLES, "scenario-strong", "synthesis.md")
        cards = tbd.parse_cards(text)
        self.assertEqual(len(cards), 1)
        card = cards[0]
        self.assertTrue(card["problem_statement"].startswith(
            "Enterprise admins cannot complete bulk permission changes"))
        self.assertNotIn("\n", card["problem_statement"])
        self.assertNotIn("\n", card["impact"])
        self.assertEqual(len(card["proof_points"]), 4)
        self.assertEqual(
            [f["name"] for f in card["frameworks"]],
            ["Five Whys", "Jobs to Be Done", "Fishbone Analysis"])
        # The wrapped, semicolon-joined multi-quote line is the case that
        # first broke this parser during development -- pin it exactly.
        self.assertEqual(card["frameworks"][1]["proof_points"], [
            '"Customers keep asking us to just do the bulk edit for them '
            'over email because they can\'t find it in the console." '
            '(CS manager, ~9:00)',
            '"We give white-glove manual bulk edits to about 20% of '
            'accounts already, informally, when someone escalates loud '
            'enough." (CS manager, ~16:45)',
            '"Three customers mentioned they almost churned because the '
            'renewal process took so long to sort out manually." '
            '(Support lead, ~19:10)',
        ])
        self.assertTrue(card["convergence_note"].startswith("Confidence:"))
        errors, _ = validator.validate(tbd.build(text))
        self.assertEqual(errors, [])

    def test_scenario_uncertain(self):
        text = read(EXAMPLES, "scenario-uncertain", "synthesis.md")
        cards = tbd.parse_cards(text)
        self.assertEqual(len(cards), 2)
        for card in cards:
            # Single contributing lens, "see top-level proof points" --
            # the proof_points key must be entirely absent, not empty,
            # so the renderer's card-level fallback actually engages.
            self.assertEqual(len(card["frameworks"]), 1)
            self.assertNotIn("proof_points", card["frameworks"][0])
        errors, _ = validator.validate(tbd.build(text))
        self.assertEqual(errors, [])


class SyntheticFixtureTests(unittest.TestCase):
    """Shapes the two real examples don't exercise on their own."""

    def setUp(self):
        self.cards = tbd.parse_cards(SYNTHETIC_SYNTHESIS)

    def test_four_framework_stack(self):
        card = self.cards[0]
        names = [f["name"] for f in card["frameworks"]]
        self.assertEqual(
            names, ["Five Whys", "Lean Wastes", "Fishbone Analysis",
                    "Jobs to Be Done"])

    def test_separator_variants_all_recognised(self):
        # Five Whys/Jobs to Be Done use an em dash, Lean Wastes an en dash,
        # Fishbone Analysis a plain hyphen -- all three must parse the same.
        by_name = {f["name"]: f for f in self.cards[0]["frameworks"]}
        self.assertNotIn("proof_points", by_name["Five Whys"])
        self.assertEqual(by_name["Lean Wastes"]["proof_points"],
                          ['"Waiting: 15 min average restart, twice a '
                           'shift." (floor log)'])
        self.assertEqual(len(by_name["Fishbone Analysis"]["proof_points"]), 2)

    def test_wrapped_problem_statement_is_one_line(self):
        statement = self.cards[0]["problem_statement"]
        self.assertNotIn("\n", statement)
        self.assertTrue(statement.startswith("Widgets jam the hopper"))
        self.assertTrue(statement.endswith("under test."))

    def test_semicolon_inside_a_proof_point_is_not_a_delimiter(self):
        # The card-level Proof Points list is never separator-split (only
        # a Frameworks entry's own content is) -- each "- " item is one
        # proof point regardless of punctuation inside it.
        self.assertEqual(len(self.cards[0]["proof_points"]), 2)
        self.assertIn("not a delimiter", self.cards[0]["proof_points"][1])

    def test_second_card_gets_the_next_grid_slot(self):
        cards = tbd.assign_ids_and_positions(self.cards)
        self.assertEqual(cards[1]["id"], "card-02")
        self.assertEqual(cards[1]["position"], {"x": 400, "y": 100})

    def test_full_build_validates_clean(self):
        errors, _ = validator.validate(tbd.build(SYNTHETIC_SYNTHESIS))
        self.assertEqual(errors, [])


class EmptyBoardTests(unittest.TestCase):

    def test_section_with_no_card_headings_is_a_valid_empty_board(self):
        text = ("# Synthesis\n\n## Structured Board Content\n\n"
                "No problem reached a traceable proof point.\n\n"
                "## Coverage Note\nNothing to add.\n")
        data = tbd.build(text)
        self.assertEqual(data["cards"], [])
        errors, warnings = validator.validate(data)
        self.assertEqual(errors, [])
        self.assertTrue(any("no cards" in w for w in warnings))


class FailureModeTests(unittest.TestCase):
    """Every one of these must raise, not guess -- see the module
    docstring's "fail loud, never guess" rule."""

    def test_missing_section_heading(self):
        with self.assertRaisesRegex(tbd.ParseError, "Structured Board"):
            tbd.parse_cards(NO_SECTION)

    def test_missing_required_field(self):
        text = ("# Synthesis\n\n## Structured Board Content\n\n"
                 "### Bad card\n"
                 "- **Problem Statement:** Something.\n"
                 "- **Impact:** Something else.\n"
                 "- **Proof Points:**\n  - \"a quote\" (source)\n"
                 "- **Convergence Note:** Confidence: X Low.\n"
                 "\n## Coverage Note\n")
        with self.assertRaisesRegex(tbd.ParseError, "Frameworks"):
            tbd.parse_cards(text)

    def test_empty_problem_statement(self):
        with self.assertRaisesRegex(tbd.ParseError, "empty Problem Statement"):
            tbd.parse_cards(EMPTY_STATEMENT)

    def test_frameworks_entry_without_a_separator(self):
        with self.assertRaisesRegex(tbd.ParseError, "Frameworks entry"):
            tbd.parse_cards(MALFORMED_NO_SEPARATOR)

    def test_empty_proof_points_rejected(self):
        # contracts/synthesis-output.md: a problem with zero proof points
        # does not belong in Structured Board Content at all -- this must
        # not silently become proof_points: [] on the board.
        with self.assertRaisesRegex(tbd.ParseError, "no Proof Points"):
            tbd.parse_cards(EMPTY_PROOF_POINTS)

    def test_empty_frameworks_rejected(self):
        # An empty frameworks array is valid on the *board* (a user-added
        # card never came from a framework), but not from the synthesizer,
        # which must always name at least one contributing lens.
        with self.assertRaisesRegex(tbd.ParseError, "no Frameworks"):
            tbd.parse_cards(EMPTY_FRAMEWORKS)

    def test_empty_convergence_note_rejected(self):
        with self.assertRaisesRegex(tbd.ParseError, "empty Convergence Note"):
            tbd.parse_cards(EMPTY_CONVERGENCE_NOTE)

    def test_missing_synthesis_file_exits_2(self):
        with self.assertRaises(SystemExit) as cm:
            tbd.read_text("/nonexistent/path/synthesis.md", "synthesis.md")
        self.assertEqual(cm.exception.code, 2)


class AtomicWriteTests(unittest.TestCase):
    """A write failure partway through must not corrupt an existing
    board-data.json -- see the P2 Codex finding on PR #20."""

    def test_write_failure_leaves_existing_file_untouched(self):
        synthesis_path = os.path.join(EXAMPLES, "scenario-strong",
                                       "synthesis.md")
        with tempfile.TemporaryDirectory() as tmp_dir:
            out_path = os.path.join(tmp_dir, "board-data.json")
            with open(out_path, "w", encoding="utf-8") as handle:
                handle.write("SENTINEL: pre-existing content\n")

            with mock.patch.object(
                tbd.json, "dump",
                side_effect=OSError("simulated disk full")
            ):
                code = tbd.main(
                    ["--synthesis", synthesis_path, "--out", out_path])

            self.assertEqual(code, 4)
            with open(out_path, "r", encoding="utf-8") as handle:
                self.assertEqual(handle.read(), "SENTINEL: pre-existing content\n")
            leftovers = [f for f in os.listdir(tmp_dir) if f != "board-data.json"]
            self.assertEqual(leftovers, [],
                              "a temp file was left behind: %r" % leftovers)


class OutputShapeTests(unittest.TestCase):

    def test_optional_board_fields_omitted_when_not_given(self):
        text = read(EXAMPLES, "scenario-uncertain", "synthesis.md")
        data = tbd.build(text)
        self.assertNotIn("board_title", data)
        self.assertNotIn("source_summary", data)
        self.assertIn("generated_at", data)

    def test_optional_board_fields_included_when_given(self):
        text = read(EXAMPLES, "scenario-uncertain", "synthesis.md")
        data = tbd.build(text, board_title="T", source_summary="S",
                          generated_at="2026-01-01T00:00:00+00:00")
        self.assertEqual(data["board_title"], "T")
        self.assertEqual(data["source_summary"], "S")
        self.assertEqual(data["generated_at"], "2026-01-01T00:00:00+00:00")

    def test_output_is_json_serialisable_round_trip(self):
        text = read(EXAMPLES, "scenario-strong", "synthesis.md")
        data = tbd.build(text)
        self.assertEqual(json.loads(json.dumps(data)), data)


if __name__ == "__main__":
    unittest.main()
