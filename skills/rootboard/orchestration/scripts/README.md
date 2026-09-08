# Orchestration Scripts

Eight standard-library helpers for deterministic run stages and diagnostics.
Python 3 only — nothing to install, nothing to build. Production helpers emit
machine-readable results where the next stage consumes them and plain-language
diagnostics on failure. Each exits non-zero on failure so a stage cannot pass
unnoticed.

During an installed run, resolve the active `SKILL.md` directory to an
absolute `ROOTBOARD_SKILL_ROOT` and invoke each helper through Python with a
quoted absolute path. Contributors may use the shorter source-repository form
`python3 skills/rootboard/orchestration/scripts/<helper>.py`. The helpers locate packaged
resources relative to their own files, so their behavior does not depend on
the shell's current working directory.

---

## `new_run.py` — stages 1 and 2

Creates the run folder and saves the input before any analysis happens.

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" < transcript.txt
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --from "/absolute/path/to/q3-retro.md"
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --from "/absolute/path/to/notes.md" --slug planning
```

Applies the naming and collision rules in `docs/invocation-and-runs.md`,
writes `input.md` byte-for-byte, and seeds `run-status.md` with every later
stage marked `pending`. Prints the absolute run folder path on stdout.

The status file also seeds timing rows for run creation, classification
start/save, and agent dispatch.

`--runs-dir DIR` overrides the default location.
`--project-local ROOT` opts into `<ROOT>/rootboard-runs/` — pass it only
when the user explicitly asked for project-local storage.

Exit codes: `0` ok · `2` RE-01 no input · `3` RE-02 file not found · `4`
RE-03 file unreadable · `5` RE-04 folder not created.

Tests: `python3 tests/python/test_new_run.py` from the source repository.

---

## `framework_catalog.py` — stage 3 selection input

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/framework_catalog.py"
```

Extracts `name`, `slug`, `good_for`, `when_to_use`, and `Known blind spot`
from every framework recipe and emits one compact JSON catalog. Framework
files remain the source of truth; the coordinator does not need their full
bodies while choosing lenses.

Exit code: `0` ok · `1` a framework file is missing required metadata or
cannot be read.

Tests: `python3 tests/python/test_framework_catalog.py` from the source repository.

---

## `record_run_event.py` — critical-path timing

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/record_run_event.py" "<absolute-run-path>" classification-started
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/record_run_event.py" "<absolute-run-path>" classification-saved
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/record_run_event.py" "<absolute-run-path>" agents-dispatched
```

Atomically updates the matching timing row in `run-status.md`. These events
measure the serial path before parallel framework work starts. Timing is
diagnostic: a recording failure is reported but does not invalidate the
analysis artifacts.

Exit code: `0` recorded · `1` the run status could not be read or updated.

Tests: `python3 tests/python/test_record_run_event.py` from the source repository.

---

## `profile_run_latency.py` — passive post-run diagnostics

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/profile_run_latency.py" "<absolute-run-path>"
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/profile_run_latency.py" "<absolute-run-path>" --json > "<absolute-run-path>/latency.json"
```

Reports the coordinator, parallel-agent, synthesis, board-data, and whiteboard
portions of a run from timestamps and file metadata the workflow already
produces. It reads artifact modification times but never reads the input,
findings, synthesis, board data, or whiteboard contents.

The coordinator calls this script at run close and redirects `--json` output
to `latency.json`, including when a run stops early. The profiler itself only
reads run data and writes its report to stdout; it does not instrument agents.
This local close-out step is excluded from `total_to_whiteboard`. A partial
run still produces available timings, with `null` durations and warnings for
what could not be measured. A profiling or save failure is disclosed without
invalidating the analysis artifacts.

Exit code: `0` profile reported · `2` the path is not recognizable as a run.

Tests: `python3 tests/python/test_profile_run_latency.py` from the source repository.

---

## `translate_board_data.py` — stage 6

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/translate_board_data.py" "<absolute-run-path>"
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/translate_board_data.py" --synthesis "/absolute/path/to/synthesis.md" --out "/absolute/path/to/board-data.json"
```

Parses `synthesis.md`'s `Structured Board Content` section per
`orchestration/board-data-translation.md` and writes `board-data.json`,
copying each field across and originating only `id` and `position` — the two
things the synthesizer doesn't provide. It is not a general markdown parser;
it recognizes exactly the shape `contracts/synthesis-output.md` requires,
tolerant of the variation real synthesizer output has shown (a value
wrapping across several lines, the Frameworks separator appearing as an em
dash, en dash, or hyphen, "see top-level proof points" in any letter case
or with or without a trailing period). Anything else stops the run rather
than guessing — `synthesis.md` is already saved, so nothing is lost by
refusing.

Validates its own output before writing, with the same check
`validate_board_data.py` runs below, and writes nothing if that fails.
`--board-title` and `--source-summary` are optional and simply omitted from
the output if not given, since both are optional per
`contracts/board-output.md`; `--generated-at` defaults to the current time.

Exit codes: `0` ok · `1` RE-10 could not parse the Structured Board Content
· `2` RE-10 `synthesis.md` missing or unreadable · `3` RE-10 the parsed
result still fails the board contract (a parser/validator mismatch, not
expected in normal use) · `4` RE-10 `board-data.json` could not be written
(e.g. a full disk) — written via a temp file and renamed into place, so an
existing `board-data.json` from a previous run is left untouched.

Tests: `python3 tests/python/test_translate_board_data.py` from the
source repository — run
against the repository's own two worked examples in
`examples/synthesizer/`, plus an invented fixture covering shapes those two
don't (a four-lens stack, each separator variant, a proof point containing
its own semicolon).

---

## `validate_board_data.py` — the stage 6 gate

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/validate_board_data.py" "<absolute-run-path>/board-data.json"
```

Checks board data against `contracts/board-output.md`: unique non-empty ids,
required `problem_statement`, `impact`, `proof_points`, `frameworks` and
`position` on every card, finite coordinates, framework entries that are
objects with names, and correct types on the optional fields. Warns
(non-fatally) about a card with no proof points, two cards at identical
coordinates, and an empty board.

This exists because the renderer will not catch any of it. Card
normalisation in `renderer/whiteboard/whiteboard.js` is deliberately
tolerant — a missing statement becomes an empty string, a bad position falls
back to a staircase, a malformed framework entry becomes "Untitled
framework", and nothing throws. That is right for a renderer that must never
fail to open a saved artifact, and it makes validation this layer's job.

Exit codes: `0` valid · `1` RE-10 contract violations · `2` missing or
unparseable file.

---

## `build_whiteboard.py` — stage 7

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/build_whiteboard.py" "<absolute-run-path>"
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/build_whiteboard.py" --board-data "/absolute/path/to/board-data.json" [--synthesis "/absolute/path/to/synthesis.md"] --out "/absolute/path/to/whiteboard.html"
```

Re-validates the board data and writes nothing if it fails, then assembles
`renderer/board-template/index.html` with `whiteboard.css`,
`whiteboard-core.js`, and `whiteboard.js` inlined and `__BOARD_DATA__`
substituted, into `<run>/whiteboard.html`. For a run-folder build it also
embeds `<run>/synthesis.md`; outside a run, pass `--synthesis` to enable the
whiteboard's Copy context action. The core module is inlined before the main
renderer.

The template's includes are relative (`../whiteboard/…`), which only resolves
inside this repository. A run folder is somewhere else entirely, and the user
may move or mail the file, so the artifact is assembled as one
self-contained page. The renderer files are read, never modified.

If the template's stylesheet link, core or renderer script tag, or
`__BOARD_DATA__` or `__SYNTHESIS_MARKDOWN__` placeholder no longer matches
what the script expects, it fails loudly rather than writing a page with a
missing renderer asset or context payload.

Exit codes: `0` built · `1` RE-10 invalid board data · `2` RE-10 missing or
unparseable board data · `3` RE-11 renderer assets or template unreadable or
changed · `4` RE-11 artifact could not be written.

---

## `check_run.py` — the stage 8 gate

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/check_run.py" "<absolute-run-path>"
```

Cross-checks three things that drift apart quietly:

- the lenses `classification.md` says were assigned,
- the findings files on disk,
- the stage results in `run-status.md`.

An assigned lens with no findings file, a findings file for a lens nobody
assigned, a lens count outside 2–4, a required file missing or empty, or a
stage still reading `pending` all fail the check. It reports a manifest
either way, so the failure names what is missing rather than only that
something is.

Exit codes: `0` complete · `1` incomplete · `2` not a run folder.

---

## If Python is unavailable

The run still works; the mechanical steps just have to be done by hand, with
more care:

- **`new_run.py`** — create the folder per `docs/invocation-and-runs.md`,
  copy the input to `input.md` without editing it, and write `run-status.md`
  with the stage table from `run-workflow.md`.
- **`framework_catalog.py`** — read only each framework's frontmatter and
  `Known blind spot` section, then present those fields together for
  selection; do not load the other framework sections.
- **`record_run_event.py`** — replace the relevant `pending` value in the
  timing table with the current ISO-8601 timestamp.
- **`translate_board_data.py`** — follow
  `orchestration/board-data-translation.md` by hand: copy each field from
  `synthesis.md`'s `Structured Board Content` across verbatim, and originate
  only `id` (`card-01`, `card-02`, …) and `position` (the grid formula in
  that file's "Position layout" section).
- **`validate_board_data.py`** — read `board-data.json` against the field
  table in `contracts/board-output.md`, card by card. The four defects worth
  checking first are duplicate ids, a missing `problem_statement`, a
  non-numeric `position`, and a framework entry that is a bare string instead
  of an object — the renderer swallows all four.
- **`build_whiteboard.py`** — copy `renderer/board-template/index.html` to
  `<run>/whiteboard.html`, replace `__BOARD_DATA__` with the board JSON,
  replace `__SYNTHESIS_MARKDOWN__` with a JSON-encoded `synthesis.md`, and
  repoint the three `../whiteboard/` includes at copies of `whiteboard.css`,
  `whiteboard-core.js`, and `whiteboard.js` placed alongside the artifact.
  Copy or inline `whiteboard-core.js` before `whiteboard.js`; inlining the CSS
  and both scripts gives the same single-file result the script produces.
- **`check_run.py`** — read `run-status.md` and confirm every stage finished
  and every assigned lens has a findings file, before reporting the run.
- **`profile_run_latency.py`** — report that `latency.json` could not be
  generated; do not invent timings to fill the missing diagnostic.

## Package compatibility checks

From the source repository root, run:

```bash
python3 tests/python/test_instruction_routing.py
python3 tests/python/test_skill_package.py
```

These checks verify that the active runtime keeps helper commands rooted at
the installed skill, delegated briefs require absolute paths, and Codex
metadata resolves to real package assets while the primary documentation
continues to cover both hosts.
