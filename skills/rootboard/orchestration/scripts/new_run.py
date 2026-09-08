#!/usr/bin/env python3
"""Create a run folder and save the raw input into it, before any analysis.

This is stages 1 and 2 of orchestration/run-workflow.md. It exists as a script
so that the input is on disk, byte-for-byte, before anything that could fail
has been attempted -- and so the folder-naming and collision rules in
docs/invocation-and-runs.md are applied the same way every run.

Usage:
    # input pasted into the conversation, handed over on stdin
    new_run.py < input.txt

    # input the user gave as a file path
    new_run.py --from ~/notes/retro.md

Options:
    --from PATH        Read the input from a file instead of stdin.
    --slug SLUG        Optional run-name override. Defaults to the input file
                       stem for file input, or "run" for pasted input.
    --runs-dir DIR     Where runs live. Default: ~/Documents/rootBoard/runs
    --project-local ROOT
                       Opt-in project-local storage: <ROOT>/rootboard-runs.
                       Only ever pass this when the user explicitly asked for it.
    --now ISO8601      Override the run timestamp (for tests).

On success the absolute run folder path is the last line on stdout.

Exit codes (see contracts/runtime-errors.md):
    0  run folder created, input saved
    2  RE-01  no input was provided
    3  RE-02  the input file does not exist
    4  RE-03  the input file exists but cannot be read as text
    5  RE-04  the run folder could not be created
"""

import argparse
import datetime
import os
import re
import sys

STAGES = [
    "1. Intake",
    "2. Run setup",
    "3. Classification",
    "4. Framework findings",
    "5. Synthesis",
    "6. Board data",
    "7. Whiteboard",
]

DEFAULT_RUNS_DIR = os.path.join("~", "Documents", "rootBoard", "runs")


def slugify(raw):
    slug = re.sub(r"[^a-z0-9]+", "-", (raw or "").lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:48].strip("-") or "run"


def choose_slug(source, override):
    """Choose a run slug without asking a model to interpret the input."""
    if override:
        return slugify(override)
    if source:
        filename = os.path.basename(os.path.expanduser(source))
        stem, _ = os.path.splitext(filename)
        return slugify(stem)
    return "run"


def read_input(source):
    """Return (raw_bytes, text, provenance). Exits with an RE code on failure."""
    if source is None:
        data = sys.stdin.buffer.read()
        if not data.strip():
            sys.stderr.write(
                "RE-01: No input was provided. This skill needs a meeting "
                "transcript or a freeform context dump to work from -- paste "
                "one in, or give a path to a text or markdown file.\n")
            sys.exit(2)
        return (data, decode(data, "the pasted input"), "pasted into the conversation")

    path = os.path.abspath(os.path.expanduser(source))

    if not os.path.exists(path):
        sys.stderr.write(
            "RE-02: There is no file at %s. Check the path, or paste the "
            "transcript in directly instead.\n" % path)
        sys.exit(3)

    if os.path.isdir(path):
        sys.stderr.write(
            "RE-03: %s is a folder, not a file. Point at the transcript file "
            "itself, or paste its contents in directly.\n" % path)
        sys.exit(4)

    try:
        with open(path, "rb") as handle:
            data = handle.read()
    except OSError as exc:
        sys.stderr.write(
            "RE-03: %s exists, but could not be opened (%s). Check the file's "
            "permissions, or paste its contents in directly.\n"
            % (path, exc.strerror or exc))
        sys.exit(4)

    if not data.strip():
        sys.stderr.write(
            "RE-01: %s is empty, so there is nothing to analyse. Point at a "
            "different file, or paste the transcript in directly.\n" % path)
        sys.exit(2)

    return (data, decode(data, path), "file: %s" % path)


def decode(data, what):
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        sys.stderr.write(
            "RE-03: %s could not be read as text -- it looks like a binary "
            "file (a PDF, a Word document, an audio file). This skill takes "
            "plain text or markdown. Export or copy the text out of it "
            "first.\n" % what)
        sys.exit(4)


def unique_run_dir(runs_dir, base_name):
    candidate = os.path.join(runs_dir, base_name)
    suffix = 2
    while os.path.exists(candidate):
        candidate = os.path.join(runs_dir, "%s-%d" % (base_name, suffix))
        suffix += 1
    return candidate


def status_document(run_dir, started, provenance, text):
    words = len(text.split())
    lines = [
        "# Run Status",
        "",
        "- **Run folder:** `%s`" % run_dir,
        "- **Started:** %s" % started,
        "- **Input source:** %s" % provenance,
        "- **Input size:** %d words, %d characters"
        % (words, len(text)),
        "",
        "## Timing",
        "",
        "These timestamps isolate the serial work before the independent",
        "framework agents begin.",
        "",
        "| Event | Timestamp |",
        "| --- | --- |",
        "| Run created | %s |" % started,
        "| Classification started | pending |",
        "| Classification saved | pending |",
        "| Agents dispatched | pending |",
        "",
        "## Stage Status",
        "",
        "Every stage of the run records its result here as it finishes. A row",
        "still reading `pending` when the run reports back means that stage",
        "never ran -- see `contracts/runtime-errors.md`. Allowed results:",
        "`ok`, `ok (degraded)`, `failed`, `skipped`, `pending`.",
        "",
        "| Stage | Result | Notes |",
        "| --- | --- | --- |",
    ]
    for stage in STAGES:
        if stage.startswith(("1.", "2.")):
            lines.append("| %s | ok | |" % stage)
        else:
            lines.append("| %s | pending | |" % stage)
    lines.append("")
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--from", dest="source")
    parser.add_argument("--slug")
    parser.add_argument("--runs-dir")
    parser.add_argument("--project-local")
    parser.add_argument("--now")
    args = parser.parse_args(argv)

    raw, text, provenance = read_input(args.source)

    if args.now:
        started = args.now
    else:
        started = datetime.datetime.now().astimezone().replace(
            microsecond=0).isoformat()

    try:
        stamp = datetime.datetime.fromisoformat(started).strftime(
            "%Y-%m-%d-%H%M")
    except ValueError:
        sys.stderr.write("--now must be an ISO-8601 timestamp.\n")
        return 1

    if args.project_local:
        runs_dir = os.path.join(
            os.path.abspath(os.path.expanduser(args.project_local)),
            "rootboard-runs")
    elif args.runs_dir:
        runs_dir = os.path.abspath(os.path.expanduser(args.runs_dir))
    else:
        runs_dir = os.path.abspath(os.path.expanduser(DEFAULT_RUNS_DIR))

    run_dir = unique_run_dir(
        runs_dir, "%s-%s" % (stamp, choose_slug(args.source, args.slug)))

    try:
        os.makedirs(run_dir)
        with open(os.path.join(run_dir, "input.md"), "wb") as handle:
            handle.write(raw)
        with open(os.path.join(run_dir, "run-status.md"), "w",
                  encoding="utf-8") as handle:
            handle.write(status_document(run_dir, started, provenance, text))
    except OSError as exc:
        sys.stderr.write(
            "RE-04: The run folder could not be created at %s (%s). Nothing "
            "was analysed and nothing was saved. Check that the location "
            "exists and is writable, or ask for the run to be saved "
            "somewhere else.\n" % (run_dir, exc.strerror or exc))
        return 5

    sys.stderr.write("Saved the input unchanged (%d words) before any "
                     "analysis.\n" % len(text.split()))
    sys.stdout.write("%s\n" % run_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
