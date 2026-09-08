#!/usr/bin/env python3
"""Profile a completed rootBoard run without instrumenting its agents.

The coordinator runs this profiler at close and redirects its JSON output to
latency.json. It reads the timing rows already present in run-status.md and
the modification times of artifacts a normal run already writes. It never
opens the input, findings, synthesis, board data, or whiteboard contents. The
profiler writes only to stdout; the caller saves the report.

Usage:
    profile_run_latency.py <run-folder>
    profile_run_latency.py <run-folder> --json
    profile_run_latency.py <run-folder> --json > <run-folder>/latency.json

Exit codes:
    0  a complete or partial profile was reported
    2  the path is not recognizable as a rootBoard run
"""

import argparse
import datetime
import json
import os
import re
import sys

sys.dont_write_bytecode = True


TIMING_ROW_RE = re.compile(
    r"^\|\s*(Run created|Classification started|Classification saved|"
    r"Agents dispatched)\s*\|\s*([^|]*?)\s*\|\s*$",
    re.MULTILINE,
)

TIMING_KEYS = {
    "Run created": "run_created",
    "Classification started": "classification_started",
    "Classification saved": "classification_saved",
    "Agents dispatched": "agents_dispatched",
}

ARTIFACTS = {
    "classification_saved": "classification.md",
    "synthesis_saved": "synthesis.md",
    "board_data_saved": "board-data.json",
    "whiteboard_saved": "whiteboard.html",
}

PHASES = (
    ("pre_dispatch", "Run created to agents dispatched"),
    ("classification", "Classification"),
    ("dispatch_handoff", "Classification saved to agents dispatched"),
    ("parallel_agents", "Parallel agents (dispatch to slowest save)"),
    ("agent_completion_spread", "Agent completion spread (first to slowest)"),
    ("handoff_and_synthesis", "Agent handoff and synthesis"),
    ("board_data_translation", "Board-data translation"),
    ("whiteboard_assembly", "Whiteboard assembly"),
    ("total_to_whiteboard", "Run created to whiteboard"),
)


class ProfileError(ValueError):
    """The requested path is not recognizable as a rootBoard run."""


def _iso(value):
    return value.isoformat() if value is not None else None


def _seconds(start, end, label, warnings):
    if start is None or end is None:
        return None
    elapsed = (end - start).total_seconds()
    if elapsed < 0:
        warnings.append(
            "%s could not be measured because its timestamps are out of order "
            "(the run may have been copied or edited after completion)." % label
        )
        return None
    return elapsed


def _mtime(path):
    return datetime.datetime.fromtimestamp(
        os.stat(path).st_mtime, tz=datetime.timezone.utc
    )


def _read_status_times(path, warnings):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            status = handle.read()
    except OSError as exc:
        warnings.append("run-status.md could not be read: %s." % (exc.strerror or exc))
        return {}

    times = {}
    for label, raw in TIMING_ROW_RE.findall(status):
        value = raw.strip()
        if not value or value.lower() == "pending":
            continue
        try:
            timestamp = datetime.datetime.fromisoformat(value)
        except ValueError:
            warnings.append("%s has an invalid timestamp: %r." % (label, value))
            continue
        if timestamp.tzinfo is None:
            warnings.append("%s has no timezone and was ignored." % label)
            continue
        times[TIMING_KEYS[label]] = timestamp
    return times


def collect(run_folder):
    """Return a passive latency profile for one complete or partial run."""
    run = os.path.abspath(os.path.expanduser(run_folder))
    if not os.path.isdir(run):
        raise ProfileError("there is no run folder at %s" % run)

    status_path = os.path.join(run, "run-status.md")
    input_path = os.path.join(run, "input.md")
    if not os.path.isfile(status_path) and not os.path.isfile(input_path):
        raise ProfileError(
            "%s has neither run-status.md nor input.md, so it does not look "
            "like a rootBoard run" % run
        )

    warnings = []
    status_times = _read_status_times(status_path, warnings)
    milestones = dict(status_times)

    if "run_created" not in milestones and os.path.isfile(input_path):
        milestones["run_created"] = _mtime(input_path)
        warnings.append(
            "Run created was missing from run-status.md; input.md's file time "
            "was used instead."
        )

    for key, filename in ARTIFACTS.items():
        path = os.path.join(run, filename)
        if os.path.isfile(path):
            artifact_time = _mtime(path)
            if key not in milestones:
                milestones[key] = artifact_time
                if key == "classification_saved":
                    warnings.append(
                        "Classification saved was missing from run-status.md; "
                        "classification.md's file time was used instead."
                    )
        elif key != "classification_saved":
            warnings.append("%s is missing; later phase timings may be partial." % filename)

    findings = sorted(
        name
        for name in os.listdir(run)
        if name.startswith("findings-") and name.endswith(".md")
        and os.path.isfile(os.path.join(run, name))
    )
    agents = []
    dispatched = milestones.get("agents_dispatched")
    for filename in findings:
        path = os.path.join(run, filename)
        completed = _mtime(path)
        lens = filename[len("findings-") : -len(".md")]
        agents.append(
            {
                "lens": lens,
                "file": filename,
                "completed_at": _iso(completed),
                "dispatch_to_save_seconds": _seconds(
                    dispatched,
                    completed,
                    "%s dispatch-to-save time" % lens,
                    warnings,
                ),
            }
        )

    if findings:
        completion_times = [
            datetime.datetime.fromisoformat(agent["completed_at"]) for agent in agents
        ]
        milestones["first_agent_saved"] = min(completion_times)
        milestones["agents_complete"] = max(completion_times)
    else:
        warnings.append("No findings-*.md files were found; agent timing is unavailable.")

    phases = {
        "pre_dispatch": _seconds(
            milestones.get("run_created"),
            milestones.get("agents_dispatched"),
            "Run created to agents dispatched",
            warnings,
        ),
        "classification": _seconds(
            milestones.get("classification_started"),
            milestones.get("classification_saved"),
            "Classification",
            warnings,
        ),
        "dispatch_handoff": _seconds(
            milestones.get("classification_saved"),
            milestones.get("agents_dispatched"),
            "Classification saved to agents dispatched",
            warnings,
        ),
        "parallel_agents": _seconds(
            milestones.get("agents_dispatched"),
            milestones.get("agents_complete"),
            "Parallel agents",
            warnings,
        ),
        "agent_completion_spread": _seconds(
            milestones.get("first_agent_saved"),
            milestones.get("agents_complete"),
            "Agent completion spread",
            warnings,
        ),
        "handoff_and_synthesis": _seconds(
            milestones.get("agents_complete"),
            milestones.get("synthesis_saved"),
            "Agent handoff and synthesis",
            warnings,
        ),
        "board_data_translation": _seconds(
            milestones.get("synthesis_saved"),
            milestones.get("board_data_saved"),
            "Board-data translation",
            warnings,
        ),
        "whiteboard_assembly": _seconds(
            milestones.get("board_data_saved"),
            milestones.get("whiteboard_saved"),
            "Whiteboard assembly",
            warnings,
        ),
        "total_to_whiteboard": _seconds(
            milestones.get("run_created"),
            milestones.get("whiteboard_saved"),
            "Run created to whiteboard",
            warnings,
        ),
    }

    missing_status_events = [
        label for label, key in TIMING_KEYS.items() if key not in status_times
    ]
    if missing_status_events:
        warnings.append(
            "Missing run-status timing event(s): %s."
            % ", ".join(missing_status_events)
        )

    return {
        "run_folder": run,
        "measurement": "passive post-run file timestamps",
        "runtime_overhead": "local profiling at run close; excluded from total_to_whiteboard",
        "milestones": {
            key: _iso(value) for key, value in sorted(milestones.items())
        },
        "phases_seconds": phases,
        "agents": agents,
        "warnings": warnings,
    }


def _format_duration(value):
    if value is None:
        return "unavailable"
    if value < 1:
        return "%.0f ms" % (value * 1000)
    if value < 10:
        return "%.2f s" % value
    return "%.1f s" % value


def render_text(profile):
    lines = [
        "Passive rootBoard latency profile",
        "Run: %s" % profile["run_folder"],
        "Measurement: existing timestamps and file metadata only; no agent or "
        "workflow instrumentation",
        "",
        "Critical path:",
    ]
    for key, label in PHASES:
        lines.append(
            "  %-49s %s" % (label, _format_duration(profile["phases_seconds"][key]))
        )

    lines.extend(["", "Agents (dispatch to findings file saved):"])
    if profile["agents"]:
        for agent in profile["agents"]:
            lines.append(
                "  %-30s %s"
                % (agent["lens"], _format_duration(agent["dispatch_to_save_seconds"]))
            )
    else:
        lines.append("  unavailable")

    lines.extend(
        [
            "",
            "Interpretation notes:",
            "  - Agent times include dispatch, model work, and saving findings.",
            "  - Handoff and synthesis includes any coordinator gap after the "
            "slowest finding was saved.",
            "  - File times can be invalidated if artifacts are copied or edited "
            "after the run.",
        ]
    )
    if profile["warnings"]:
        lines.extend(["", "Warnings:"])
        lines.extend("  - %s" % warning for warning in profile["warnings"])
    return "\n".join(lines) + "\n"


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("run_folder")
    parser.add_argument(
        "--json", action="store_true", help="emit machine-readable JSON"
    )
    args = parser.parse_args(argv)

    try:
        profile = collect(args.run_folder)
    except ProfileError as exc:
        sys.stderr.write("Could not profile run latency: %s.\n" % exc)
        return 2

    if args.json:
        json.dump(profile, sys.stdout, indent=2, sort_keys=True)
        sys.stdout.write("\n")
    else:
        sys.stdout.write(render_text(profile))
    return 0


if __name__ == "__main__":
    sys.exit(main())
