#!/usr/bin/env python3
"""Validate board data against contracts/board-output.md.

The renderer is deliberately tolerant: a missing problem_statement becomes an
empty string, a non-numeric position falls back to a staircase, a malformed
framework entry becomes "Untitled framework", and duplicate ids render two
cards that delete as one. Nothing throws. That tolerance is correct for a
renderer that must never fail to open a saved artifact, which makes validation
the workflow's job -- this script.

Usage:
    validate_board_data.py <board-data.json>

Exit codes:
    0  valid (warnings may still be printed)
    1  invalid -- one or more contract violations, listed on stderr
    2  the file could not be read, or is not JSON

Also importable:  validate(data) -> (errors, warnings)
"""

import json
import math
import sys
from numbers import Real

CREATED_BY = ("agent", "user")
CONFIDENCE_LEVELS = ("high", "medium", "low")


def _is_str(value):
    return isinstance(value, str)


def _is_nonempty_str(value):
    return isinstance(value, str) and value.strip() != ""


def _is_finite_number(value):
    # bool is a subclass of int; a boolean coordinate is not a number here.
    if isinstance(value, bool) or not isinstance(value, Real):
        return False
    return math.isfinite(value)


def _label(index, card):
    if isinstance(card, dict) and _is_nonempty_str(card.get("id")):
        return "card %d (id %r)" % (index, card["id"])
    return "card %d" % index


def validate(data):
    """Return (errors, warnings) as lists of plain-language strings."""
    errors = []
    warnings = []

    if not isinstance(data, dict):
        return (["Board data must be a JSON object, not a %s."
                 % type(data).__name__], warnings)

    for field in ("board_title", "generated_at", "source_summary"):
        if field in data and not _is_str(data[field]):
            errors.append("Top-level %r must be a string if present." % field)

    if "cards" not in data:
        errors.append("Board data has no 'cards' array. The minimal valid "
                      "board is {\"cards\": []}.")
        return (errors, warnings)

    cards = data["cards"]
    if not isinstance(cards, list):
        errors.append("'cards' must be an array, not a %s."
                      % type(cards).__name__)
        return (errors, warnings)

    if not cards:
        warnings.append("The board has no cards. That is valid, but confirm "
                        "an empty board is really what this run produced.")

    seen_ids = {}
    positions = {}

    for index, card in enumerate(cards):
        where = _label(index, card)

        if not isinstance(card, dict):
            errors.append("%s is not an object." % where)
            continue

        card_id = card.get("id")
        if not _is_nonempty_str(card_id):
            errors.append("%s has no 'id'. Every card needs a non-empty "
                          "string id." % where)
        elif card_id in seen_ids:
            errors.append(
                "%s reuses the id %r, already used by card %d. Ids must be "
                "unique -- the renderer deletes by id, so two cards sharing "
                "one id disappear together."
                % (where, card_id, seen_ids[card_id]))
        else:
            seen_ids[card_id] = index

        if not _is_nonempty_str(card.get("problem_statement")):
            errors.append("%s has no 'problem_statement'. It is required, and "
                          "renders as a blank card face when missing." % where)

        if not _is_nonempty_str(card.get("impact")):
            errors.append("%s has no 'impact'. It is required." % where)

        proof_points = card.get("proof_points")
        if not isinstance(proof_points, list):
            errors.append("%s has no 'proof_points' array. It may be empty, "
                          "but it must be present." % where)
        else:
            for i, point in enumerate(proof_points):
                if not _is_nonempty_str(point):
                    errors.append("%s proof point %d is not a non-empty "
                                  "string." % (where, i))
            if not proof_points:
                warnings.append("%s has no proof points. Proof points are "
                                "what make a card trustworthy -- confirm the "
                                "source material really supports none."
                                % where)

        frameworks = card.get("frameworks")
        if not isinstance(frameworks, list):
            errors.append("%s has no 'frameworks' array. It may be empty, "
                          "but it must be present." % where)
        else:
            for i, framework in enumerate(frameworks):
                if not isinstance(framework, dict):
                    errors.append(
                        "%s framework entry %d is a %s, not an object with a "
                        "'name'. The renderer shows it as \"Untitled "
                        "framework\" rather than failing."
                        % (where, i, type(framework).__name__))
                    continue
                if not _is_nonempty_str(framework.get("name")):
                    errors.append("%s framework entry %d has no 'name'."
                                  % (where, i))
                fw_points = framework.get("proof_points")
                if fw_points is not None:
                    if not isinstance(fw_points, list):
                        errors.append("%s framework entry %d has a "
                                      "'proof_points' that is not an array."
                                      % (where, i))
                    else:
                        for j, point in enumerate(fw_points):
                            if not _is_nonempty_str(point):
                                errors.append(
                                    "%s framework entry %d proof point %d is "
                                    "not a non-empty string." % (where, i, j))
                confidence = framework.get("confidence")
                if confidence is not None and (
                    not _is_str(confidence)
                    or confidence.lower() not in CONFIDENCE_LEVELS
                ):
                    errors.append(
                        "%s framework entry %d has confidence %r; it must be "
                        "\"High\", \"Medium\", or \"Low\" if present."
                        % (where, i, confidence))

        position = card.get("position")
        if not isinstance(position, dict):
            errors.append("%s has no 'position' object. Give it {x, y} "
                          "numbers so cards do not land on top of each other."
                          % where)
        else:
            for axis in ("x", "y"):
                if axis not in position:
                    errors.append("%s position is missing '%s'."
                                  % (where, axis))
                elif not _is_finite_number(position[axis]):
                    errors.append("%s position.%s is %r, not a finite number."
                                  % (where, axis, position[axis]))
            if all(_is_finite_number(position.get(a)) for a in ("x", "y")):
                key = (position["x"], position["y"])
                if key in positions:
                    warnings.append(
                        "%s sits at exactly the same position as card %d. "
                        "They will overlap." % (where, positions[key]))
                else:
                    positions[key] = index

        created_by = card.get("created_by")
        if created_by is not None and created_by not in CREATED_BY:
            errors.append("%s has created_by %r; it must be \"agent\" or "
                          "\"user\" if present." % (where, created_by))

        tags = card.get("tags")
        if tags is not None:
            if not isinstance(tags, list):
                errors.append("%s has a 'tags' that is not an array." % where)
            elif not all(_is_str(t) for t in tags):
                errors.append("%s has a non-string entry in 'tags'." % where)

        note = card.get("convergence_note")
        if note is not None and not _is_str(note):
            errors.append("%s has a 'convergence_note' that is not a string."
                          % where)

        tension = card.get("tension")
        if tension is not None and not isinstance(tension, bool):
            errors.append("%s has a 'tension' that is not a boolean." % where)

    return (errors, warnings)


def load(path):
    """Read and parse a board-data file.

    Raises ValueError carrying a plain-language message.
    """
    try:
        with open(path, "r", encoding="utf-8") as handle:
            text = handle.read()
    except FileNotFoundError:
        raise ValueError("There is no board data file at %s." % path)
    except OSError as exc:
        raise ValueError("Could not read the board data at %s: %s"
                         % (path, exc.strerror or exc))
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise ValueError("The board data at %s is not valid JSON: %s "
                         "(line %d, column %d)."
                         % (path, exc.msg, exc.lineno, exc.colno))


def main(argv):
    if len(argv) != 2:
        sys.stderr.write("usage: validate_board_data.py <board-data.json>\n")
        return 2

    try:
        data = load(argv[1])
    except ValueError as exc:
        sys.stderr.write("%s\n" % exc)
        return 2

    errors, warnings = validate(data)

    for warning in warnings:
        sys.stderr.write("warning: %s\n" % warning)

    if errors:
        sys.stderr.write("\n%d problem%s with the board data in %s:\n"
                         % (len(errors), "" if len(errors) == 1 else "s",
                            argv[1]))
        for error in errors:
            sys.stderr.write("  - %s\n" % error)
        sys.stderr.write("\nThe board was not built. Fix the board data (or "
                         "the synthesis it was translated from) and try "
                         "again.\n")
        return 1

    count = len(data.get("cards", []))
    sys.stdout.write("Board data is valid: %d card%s.\n"
                     % (count, "" if count == 1 else "s"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
