#!/usr/bin/env python3
"""Turn synthesis.md's Structured Board Content into board-data.json.

This is stage 6 of orchestration/run-workflow.md, automating the mechanical
translation orchestration/board-data-translation.md defines: copy each
synthesized problem's fields across, and originate only the two things the
synthesizer doesn't provide -- `id` and `position` (see that file's "The one
thing the synthesizer left for this step").

This script deliberately does not try to be a general markdown parser. It
recognizes exactly the shape contracts/synthesis-output.md requires and the
two worked examples in examples/synthesizer/ actually use: a
"## Structured Board Content" section containing one "### <title>" block per
problem, each with five "- **Label:**" fields (Problem Statement, Impact,
Proof Points, Frameworks, Convergence Note). Within that shape it tolerates
the variation real synthesizer output has shown:

  - a field's value wrapping across multiple physical lines (ordinary
    markdown soft-wrap, not a new field);
  - the Frameworks "<Name> -- <content>" separator appearing as an em dash,
    en dash, or plain hyphen;
  - "see top-level proof points" appearing with or without a trailing
    period, in any letter case.

Anything else -- a missing field, a missing section, a card the parser can't
confidently read -- is a reason to stop and say exactly what didn't match,
not a reason to guess. synthesis.md is already saved by the time this runs,
so a refusal here costs nothing: the analysis is intact either way.

Usage:
    translate_board_data.py <run-folder>
    translate_board_data.py --synthesis PATH --out PATH

Options:
    --board-title TEXT      board_title (contracts/board-output.md). Left
                             out of the output if not given -- the renderer
                             falls back to a generic title on its own.
    --source-summary TEXT   source_summary. Also left out if not given.
    --generated-at ISO8601  Defaults to the current time if not given.

On success the absolute board-data.json path is the last line on stdout.

Exit codes (see contracts/runtime-errors.md):
    0  board-data.json written
    1  RE-10  synthesis.md's Structured Board Content could not be parsed
    2  RE-10  synthesis.md is missing or could not be read
    3  RE-10  the translated data still fails contracts/board-output.md
              (defensive -- the parser enforces the same required fields,
              so reaching this means the parser and the validator have
              drifted apart from each other)
    4  RE-10  board-data.json could not be written (e.g. a full disk).
              Written via a temp file and renamed into place, so an
              existing board-data.json from a previous run is untouched.
"""

import argparse
import datetime
import json
import os
import re
import sys

# See build_whiteboard.py for why: installed as plain files, often via a
# read-only symlink, so a stray __pycache__ is noise at best.
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_board_data as validator  # noqa: E402

SECTION_RE = re.compile(r"(?m)^##\s+Structured Board Content\s*$")
NEXT_H2_RE = re.compile(r"(?m)^##\s+\S")
CARD_RE = re.compile(r"(?m)^###\s+(.+?)\s*$")
FIELD_RE = re.compile(r"(?m)^-\s+\*\*([A-Za-z][A-Za-z /]*?):\*\*[ \t]*")
ITEM_RE = re.compile(r"(?m)^[ \t]+-[ \t]+")
# Em dash, en dash, or a plain hyphen -- always surrounded by whitespace in
# practice, so it can't be confused with a hyphenated word inside a
# framework's own proof-point text (e.g. "white-glove").
NAME_SEP_RE = re.compile(r"\s[—–-]\s")
SEE_TOP_LEVEL_RE = re.compile(r"see top-level proof points", re.IGNORECASE)
# Splits a Frameworks item's content on "; " only when what follows looks
# like the start of the next quoted proof point or its locator, not a
# semicolon that happens to sit inside one.
MULTI_POINT_SPLIT_RE = re.compile(r';\s+(?=["(])')

REQUIRED_FIELDS = (
    "Problem Statement",
    "Impact",
    "Proof Points",
    "Frameworks",
    "Convergence Note",
)


class ParseError(ValueError):
    """A synthesis.md that doesn't match the shape this script parses."""


def _truncate(text, limit=80):
    text = text.strip().replace("\n", " ")
    return text if len(text) <= limit else text[:limit].rstrip() + "..."


def _join_wrapped(text):
    """Collapse a soft-wrapped markdown span back into one flowing line.

    A field's value is prose that wraps at the source file's line width,
    not separate paragraphs -- board-output.md's string fields are single
    strings, so a literal newline here would be a parsing artifact rather
    than real content.
    """
    lines = [ln.strip() for ln in text.splitlines()]
    return " ".join(ln for ln in lines if ln).strip()


def _split_items(text):
    """Split a field's raw text into its nested "- " list items.

    Slices between item-marker positions rather than walking line by line,
    so an item's own value can wrap across lines the same way a top-level
    field's can (see _join_wrapped) without special-casing it twice.
    """
    matches = list(ITEM_RE.finditer(text))
    if not matches:
        return []
    return [
        _join_wrapped(text[matches[i].end():
                            matches[i + 1].start() if i + 1 < len(matches)
                            else len(text)])
        for i in range(len(matches))
    ]


def _split_fields(block_text):
    """Return {field label: raw text} for one "### <title>" card block."""
    matches = list(FIELD_RE.finditer(block_text))
    fields = {}
    for i, m in enumerate(matches):
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(block_text)
        fields[m.group(1).strip()] = block_text[start:end]
    return fields


def _parse_frameworks(raw, title):
    """Turn a card's Frameworks field into board-output.md's frameworks array."""
    frameworks = []
    for item in _split_items(raw):
        sep = NAME_SEP_RE.search(item)
        if not sep:
            raise ParseError(
                "card %r: a Frameworks entry doesn't match \"<Name> -- "
                "<content>\": %r" % (title, _truncate(item)))
        name = item[:sep.start()].strip()
        content = item[sep.end():].strip()
        if not name:
            raise ParseError(
                "card %r: a Frameworks entry has no framework name before "
                "the separator: %r" % (title, _truncate(item)))
        entry = {"name": name}
        if not SEE_TOP_LEVEL_RE.search(content):
            points = [p.strip() for p in MULTI_POINT_SPLIT_RE.split(content)
                      if p.strip()]
            entry["proof_points"] = points
        frameworks.append(entry)
    return frameworks


def parse_cards(synthesis_text):
    """Return board-output.md Card dicts (minus id/position), in document
    order, from synthesis.md's Structured Board Content section.
    """
    section_match = SECTION_RE.search(synthesis_text)
    if not section_match:
        raise ParseError(
            "no \"## Structured Board Content\" heading found -- this "
            "doesn't look like a valid synthesis.md")

    rest = synthesis_text[section_match.end():]
    next_h2 = NEXT_H2_RE.search(rest)
    section_text = rest[:next_h2.start()] if next_h2 else rest

    card_starts = list(CARD_RE.finditer(section_text))
    cards = []
    for i, cm in enumerate(card_starts):
        title = cm.group(1).strip()
        block_start = cm.end()
        block_end = (card_starts[i + 1].start() if i + 1 < len(card_starts)
                      else len(section_text))
        fields = _split_fields(section_text[block_start:block_end])

        missing = [f for f in REQUIRED_FIELDS if f not in fields]
        if missing:
            raise ParseError(
                "card %r is missing required field(s): %s"
                % (title, ", ".join(missing)))

        problem_statement = _join_wrapped(fields["Problem Statement"])
        impact = _join_wrapped(fields["Impact"])
        if not problem_statement:
            raise ParseError("card %r has an empty Problem Statement" % title)
        if not impact:
            raise ParseError("card %r has an empty Impact" % title)

        # contracts/synthesis-output.md's "What must always be present"
        # requires all three of these for anything that reached Structured
        # Board Content -- an empty one here means either the synthesizer
        # produced a card that shouldn't exist, or the parser misread a
        # populated field as empty. Either way that's worth stopping for,
        # not worth silently downgrading into a thin-looking card: the
        # renderer's own tolerance (an empty proof_points array is only a
        # warning, an empty frameworks array is valid for a user-added
        # card) exists for a different case than this one.
        proof_points = _split_items(fields["Proof Points"])
        if not proof_points:
            raise ParseError("card %r has no Proof Points" % title)

        frameworks = _parse_frameworks(fields["Frameworks"], title)
        if not frameworks:
            raise ParseError("card %r has no Frameworks" % title)

        convergence_note = _join_wrapped(fields["Convergence Note"])
        if not convergence_note:
            raise ParseError("card %r has an empty Convergence Note" % title)

        cards.append({
            "problem_statement": problem_statement,
            "impact": impact,
            "proof_points": proof_points,
            "frameworks": frameworks,
            "convergence_note": convergence_note,
        })
    return cards


def assign_ids_and_positions(cards):
    """Mechanical layout per orchestration/board-data-translation.md:
    card-01, card-02... in document order, four per row.
    """
    for index, card in enumerate(cards):
        card["id"] = "card-%02d" % (index + 1)
        card["position"] = {
            "x": 80 + (index % 4) * 320,
            "y": 100 + (index // 4) * 340,
        }
    return cards


def build(synthesis_text, board_title=None, source_summary=None,
          generated_at=None):
    cards = assign_ids_and_positions(parse_cards(synthesis_text))
    data = {
        "generated_at": generated_at or datetime.datetime.now().astimezone()
        .replace(microsecond=0).isoformat(),
        "cards": cards,
    }
    if board_title:
        data["board_title"] = board_title
    if source_summary:
        data["source_summary"] = source_summary
    # Cosmetic only -- reorder to match contracts/board-output.md's own
    # documented field order, so a hand-diff against a worked example lines
    # up field for field.
    return {k: data[k] for k in
            ("board_title", "generated_at", "source_summary", "cards")
            if k in data}


def read_text(path, what):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    except OSError as exc:
        sys.stderr.write(
            "RE-10: %s could not be read (%s at %s). Nothing was "
            "translated.\n" % (what, exc.strerror or exc, path))
        sys.exit(2)


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("run_folder", nargs="?")
    parser.add_argument("--synthesis")
    parser.add_argument("--out")
    parser.add_argument("--board-title")
    parser.add_argument("--source-summary")
    parser.add_argument("--generated-at")
    args = parser.parse_args(argv)

    if args.run_folder:
        run = os.path.abspath(os.path.expanduser(args.run_folder))
        synthesis_path = args.synthesis or os.path.join(run, "synthesis.md")
        out_path = args.out or os.path.join(run, "board-data.json")
    elif args.synthesis:
        synthesis_path = args.synthesis
        out_path = args.out or os.path.join(
            os.path.dirname(os.path.abspath(args.synthesis)),
            "board-data.json")
    else:
        parser.error("give a run folder, or --synthesis with --out")

    text = read_text(synthesis_path, "synthesis.md")

    try:
        data = build(text, args.board_title, args.source_summary,
                     args.generated_at)
    except ParseError as exc:
        sys.stderr.write(
            "RE-10: Could not parse the Structured Board Content in %s: "
            "%s.\nNothing was written. synthesis.md itself is unaffected -- "
            "fix the section (or report this as a parser gap) and try "
            "again.\n" % (synthesis_path, exc))
        return 1

    errors, warnings = validator.validate(data)
    for warning in warnings:
        sys.stderr.write("warning: %s\n" % warning)
    if errors:
        sys.stderr.write(
            "RE-10: The translated data still breaks the board contract in "
            "%d way%s, which the parser above should not be able to "
            "produce -- treat this as a parser bug, not a synthesis "
            "problem:\n" % (len(errors), "" if len(errors) == 1 else "s"))
        for error in errors:
            sys.stderr.write("  - %s\n" % error)
        return 3

    # Written to a temp file in the same directory, then renamed into place,
    # so a write failure partway through (a full disk, most plausibly)
    # cannot truncate an existing board-data.json from a previous run --
    # os.replace only happens once the new content is fully on disk.
    tmp_path = "%s.tmp-%d" % (out_path, os.getpid())
    try:
        with open(tmp_path, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
        os.replace(tmp_path, out_path)
    except OSError as exc:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
        sys.stderr.write(
            "RE-10: Could not write %s (%s). Any board-data.json already "
            "there is unchanged.\n" % (out_path, exc.strerror or exc))
        return 4

    stacks = sum(1 for c in data["cards"] if len(c["frameworks"]) > 1)
    sys.stderr.write(
        "Translated %d card%s (%d converged stack%s) from %s.\n"
        % (len(data["cards"]), "" if len(data["cards"]) == 1 else "s",
           stacks, "" if stacks == 1 else "s", synthesis_path))
    sys.stdout.write("%s\n" % out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
