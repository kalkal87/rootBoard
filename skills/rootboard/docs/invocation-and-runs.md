# Invocation and Run Storage

This document defines where a rootBoard run lives on disk, what it
contains, and how the skill is installed. `SKILL.md` points here rather than
repeating these details.

It covers *where things land*. For the compact runtime path, see
`orchestration/coordinator.md`; `orchestration/run-workflow.md` is the
detailed stage-and-gate reference.

## Default run location

Every run gets its own folder under:

```
~/Documents/rootBoard/runs/<run-name>/
```

This is deliberately outside any project repository. The input to this skill
is often a meeting transcript or a raw context dump — material the user may
not want sitting in a git-tracked folder, showing up in `git status`, or
accidentally committed. Keeping runs in the user's own Documents folder by
default means running this skill never pollutes whatever project the user
happens to be working in when they think of it.

A sandboxed host such as Codex may require approval before writing outside
the active project. Request access only for `~/Documents/rootBoard/runs/` and
retry the same location. If the user declines, offer project-local storage
and use it only after explicit consent; never relocate a run silently.

### Naming a run folder

`<run-name>` should be both unique and easy to recognize later in a plain
Finder/Explorer window, so use:

```
<YYYY-MM-DD-HHmm>-<short-slug>
```

- The timestamp is when the run started, so runs sort chronologically by
  filename.
- For file input, the slug is the source file's stem in kebab case
  (`Q3 Retro Notes.md` becomes `q3-retro-notes`). Pasted input uses `run`.
  This naming step does not ask the coordinator to interpret a long input.
  `--slug` remains available when the user explicitly supplies a run name.
- If a folder with the resulting name already exists (e.g. the skill was run
  twice in the same minute), append `-2`, `-3`, etc. until the name is free.
  Never overwrite an existing run folder.

`orchestration/scripts/new_run.py` applies all of the above — the timestamp,
the slug, the collision suffix — and creates the folder:

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" < transcript.txt
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --from "/absolute/path/to/q3-retro.md"
```

`ROOTBOARD_SKILL_ROOT` is the resolved absolute directory containing the
active `SKILL.md`. Expand the placeholder before execution so the command
works when the host was launched from an unrelated project.

It prints the absolute run folder path, saves `input.md` unchanged, and seeds
`run-status.md`, all before any analysis begins. Use it rather than creating
the folder by hand, so the convention above holds run to run.

### What goes in a run folder

A run folder is flat — one level, no subfolders — so it stays browsable in a
plain Finder or Explorer window, which is where a non-technical user will
meet it.

| Path | Written at | Contents |
| --- | --- | --- |
| `input.md` | stage 2 | The raw transcript or context dump byte-for-byte as provided, saved before any analysis runs. |
| `run-status.md` | stage 2, updated throughout | One row per stage, recording how each went. See below. |
| `classification.md` | stage 3 | The classifier's chosen lenses and its reasoning for picking them. |
| `findings-<framework-slug>.md` | stage 4 | One file per problem-solving agent, in the format and under the filename defined by `contracts/agent-findings.md`. |
| `synthesis.md` | stage 5 | The synthesizer's synthesis, per `contracts/synthesis-output.md`. |
| `board-data.json` | stage 6 | The structured board data handed to the renderer, in the format defined by `contracts/board-output.md`. |
| `whiteboard.html` | stage 7 | The final rendered interactive whiteboard artifact — the deliverable. |
| `latency.json` | stage 8, at run close | Diagnostic milestones, phase durations, per-lens timings, and warnings from the latency profiler. Also saved for partial runs when possible. |

So a finished three-lens run looks like:

```
2026-08-27-1430-onboarding-drop-off/
├── input.md
├── run-status.md
├── classification.md
├── findings-five-whys.md
├── findings-jobs-to-be-done.md
├── findings-lean-wastes.md
├── synthesis.md
├── board-data.json
├── whiteboard.html
└── latency.json
```

`whiteboard.html` is self-contained: the renderer's CSS and JavaScript are
inlined into it at build time, so the user can move, copy, or mail the single
file and it still opens. It does not reach back into the installed skill.

`orchestration/scripts/check_run.py` verifies the analysis and whiteboard
files at the end of a run — every required file present and non-empty, and a
findings file for every lens `classification.md` says was assigned. The
coordinator separately confirms that `latency.json` was saved as valid JSON;
a missing diagnostic is disclosed but does not invalidate the analysis.

### `latency.json`

At run close, the coordinator saves the JSON output of
`orchestration/scripts/profile_run_latency.py` in this file. It contains the
run path, measurement notes, milestone timestamps, phase durations in seconds,
per-lens dispatch-to-save timings, and warnings. Timings come from the
`run-status.md` events and artifact modification times. Unavailable or invalid
durations remain `null`; the profiler can therefore also report partial runs.

`total_to_whiteboard` measures run creation to the saved whiteboard, excluding
the later completeness check and profiling step. Agent durations include
dispatch, model work, and saving findings; they are not model-only timings.

### `run-status.md`

Created with the run folder, with every stage after setup marked `pending`,
and updated by each stage as it finishes. Results are `ok`, `ok (degraded)`,
`failed`, `skipped`, or `pending`.

It also contains diagnostic timestamps for run creation, classification
start, classification save, and framework-agent dispatch. These isolate the
serial coordinator path from the parallel analysis time; missing timing does
not turn otherwise valid analysis into a failed run.

It exists so that a stage which never ran cannot pass for one that did: a row
still reading `pending` when the run reports back is a stage that was
skipped, and `check_run.py` fails the run on it. It also gives the user a
plain record of what happened — which lenses ran, which found little, where
a run stopped — without reading the analysis files. See
`contracts/runtime-errors.md` for what each failure records there.

Once a run folder is created, report its path back to the user **immediately**
— before the analysis runs, not after it finishes. If a later stage fails,
the user already knows where the partial work is.

## Requesting project-local storage instead

Some users will want a run tracked alongside a specific project on purpose
(e.g. a retro whose output should live in that repo's `docs/` history). When
the user explicitly asks for this — for example, "save this run in the
project" or "put this in the repo" — create the run folder at:

```
<project-root>/rootboard-runs/<run-name>/
```

by passing `--project-local <project-root>` to
`orchestration/scripts/new_run.py`, using the same `<run-name>` and folder
contents as above, and let the user
know that unlike the default location, this folder is inside their project
and will show up in `git status` unless they gitignore it. Never choose
project-local storage on your own judgment — it is opt-in only, precisely
because the default exists to avoid this outcome.

## Privacy and cleanup

- Run folders can contain sensitive material verbatim — meeting transcripts,
  internal strategy notes, names of people and companies. The default
  location keeps this out of any git history, but it is still plain text on
  disk under the user's home directory, not encrypted or access-controlled.
- This skill does not delete old runs automatically, and does not phone
  anything home — everything it produces stays local to the machine it ran
  on. Over time, `~/Documents/rootBoard/runs/` will accumulate one
  folder per run.
- Because folder names are self-describing (timestamp plus a short slug),
  the user can browse `~/Documents/rootBoard/runs/` directly and delete
  any run folder they no longer want kept, the same way they'd delete any
  other folder in Documents. If a user asks for a run to be deleted or for
  the runs folder to be cleaned up, treat that like any other file-deletion
  request — confirm what's being removed before deleting it.

## Global installation

This directory is the **distributable package** for the skill. In the source
repository it lives at `skills/rootboard/`, where the prompts, framework
recipes, contracts, orchestration helpers, and renderer are developed and
versioned together.

To make the skill available from any project, use the Skills CLI; it installs
`skills/rootboard/` as one complete skill directory and reports the selected
destination:

```bash
npx skills add kalkal87/rootBoard --skill rootboard --global --agent codex
```

Manual and host-specific alternatives are:

| Host and route | Installed skill root |
| --- | --- |
| Claude Code | `~/.claude/skills/rootboard/` |
| Codex Skills CLI | the destination reported by the CLI |
| Codex `$skill-installer` | the destination it reports, normally `$CODEX_HOME/skills/rootboard/` with `CODEX_HOME` defaulting to `~/.codex` |
| Codex manual symlink or copy | `~/.agents/skills/rootboard/` |

The runtime discovers its actual root from the active `SKILL.md` path; it
does not hard-code any of these locations. See `docs/sharing.md` for install,
update, discovery, and host-specific invocation instructions.
