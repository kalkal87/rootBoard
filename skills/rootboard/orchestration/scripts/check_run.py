#!/usr/bin/env python3
"""Check that a run folder actually contains everything the run claims.

This is the closing gate of orchestration/run-workflow.md, and the mechanism
behind one of Ticket 6's acceptance conditions: a failed stage must not
silently appear to have succeeded. It compares three things that can drift
apart:

  * the lenses `classification.md` says were assigned,
  * the findings files actually on disk,
  * the stage results recorded in `run-status.md`.

Nothing here judges the quality of the analysis -- only whether the run is
what it says it is.

Usage:
    check_run.py <run-folder>

Exit codes:
    0  the run is complete
    1  the run is incomplete; what is missing is listed on stdout
    2  the folder is not a run folder
"""

import argparse
import os
import re
import sys

REQUIRED = [
    ("input.md", "the original input, saved unchanged"),
    ("run-status.md", "the per-stage record of how the run went"),
    ("classification.md", "the classifier's chosen lenses and reasoning"),
    ("synthesis.md", "the synthesis the user reads"),
    ("board-data.json", "the structured board data handed to the renderer"),
    ("whiteboard.html", "the whiteboard artifact"),
]

# "### 1. Five Whys (`five-whys`)" -> five-whys
LENS_RE = re.compile(r"^###\s*\d+\.\s*.+?\(`([a-z0-9][a-z0-9-]*)`\)",
                     re.MULTILINE)
STATUS_ROW_RE = re.compile(r"^\|\s*(\d+\.[^|]+?)\s*\|\s*([^|]*?)\s*\|",
                           re.MULTILINE)


def read(path):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    except OSError:
        return None


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("run_folder")
    args = parser.parse_args(argv)

    run = os.path.abspath(os.path.expanduser(args.run_folder))
    if not os.path.isdir(run):
        sys.stderr.write("There is no run folder at %s.\n" % run)
        return 2

    problems = []
    lines = ["Run folder: %s" % run, ""]

    for name, description in REQUIRED:
        path = os.path.join(run, name)
        if not os.path.isfile(path):
            lines.append("  MISSING  %-20s %s" % (name, description))
            problems.append("%s was never written (%s)" % (name, description))
        elif os.path.getsize(path) == 0:
            lines.append("  EMPTY    %-20s %s" % (name, description))
            problems.append("%s is empty" % name)
        else:
            lines.append("  ok       %-20s %s" % (name, description))

    classification = read(os.path.join(run, "classification.md"))
    if classification:
        assigned = LENS_RE.findall(classification)
        if not assigned:
            problems.append(
                "classification.md names no lens slugs in the "
                "`### N. Name (`slug`)` form, so the findings files cannot be "
                "checked against it")
        else:
            lines.append("")
            lines.append("Lenses assigned by the classifier: %d"
                         % len(assigned))
            if not 2 <= len(assigned) <= 4:
                problems.append(
                    "the classifier assigned %d lenses; the contract is 2-4"
                    % len(assigned))
            for slug in assigned:
                findings = os.path.join(run, "findings-%s.md" % slug)
                if not os.path.isfile(findings):
                    lines.append("  MISSING  findings-%s.md" % slug)
                    problems.append(
                        "the %s lens was assigned but never produced a "
                        "findings file" % slug)
                elif os.path.getsize(findings) == 0:
                    lines.append("  EMPTY    findings-%s.md" % slug)
                    problems.append("findings-%s.md is empty" % slug)
                else:
                    lines.append("  ok       findings-%s.md" % slug)

        stray = sorted(
            name for name in os.listdir(run)
            if name.startswith("findings-") and name.endswith(".md")
            and name[len("findings-"):-len(".md")] not in set(assigned))
        for name in stray:
            lines.append("  EXTRA    %s" % name)
            problems.append(
                "%s is in the run folder but no lens by that slug appears in "
                "classification.md" % name)

    status = read(os.path.join(run, "run-status.md"))
    if status:
        unfinished = [
            (stage, result) for stage, result in STATUS_ROW_RE.findall(status)
            if result.lower() not in ("ok", "ok (degraded)", "skipped",
                                      "result")
        ]
        if unfinished:
            lines.append("")
            lines.append("Stages not recorded as finished:")
            for stage, result in unfinished:
                lines.append("  %-24s %s" % (stage, result or "(blank)"))
                problems.append("stage \"%s\" is recorded as %s"
                                % (stage, result or "blank"))

    sys.stdout.write("\n".join(lines) + "\n")

    if problems:
        sys.stdout.write(
            "\nThis run is INCOMPLETE. Do not describe it to the user as a "
            "finished analysis:\n")
        for problem in problems:
            sys.stdout.write("  - %s\n" % problem)
        return 1

    sys.stdout.write("\nThis run is complete.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
