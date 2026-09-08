#!/usr/bin/env python3
"""Record critical-path timestamps in a rootBoard run status file.

Usage:
    record_run_event.py <run-folder> classification-started
    record_run_event.py <run-folder> classification-saved
    record_run_event.py <run-folder> agents-dispatched
"""

import argparse
import datetime
import os
import re
import sys
import tempfile

EVENTS = {
    "classification-started": "Classification started",
    "classification-saved": "Classification saved",
    "agents-dispatched": "Agents dispatched",
}


def record(run_folder, event, timestamp):
    if event not in EVENTS:
        raise ValueError("unknown run event: %s" % event)
    try:
        datetime.datetime.fromisoformat(timestamp)
    except ValueError:
        raise ValueError("timestamp must be ISO-8601: %s" % timestamp)

    run = os.path.abspath(os.path.expanduser(run_folder))
    status_path = os.path.join(run, "run-status.md")
    try:
        with open(status_path, "r", encoding="utf-8") as handle:
            status = handle.read()
        status_mode = os.stat(status_path).st_mode & 0o777
    except OSError as exc:
        raise ValueError("could not read %s: %s" % (status_path, exc))

    label = EVENTS[event]
    pattern = re.compile(
        r"^\|\s*%s\s*\|\s*[^|]*\|\s*$" % re.escape(label),
        re.MULTILINE)
    replacement = "| %s | %s |" % (label, timestamp)
    updated, count = pattern.subn(replacement, status)
    if count != 1:
        raise ValueError(
            "run-status.md has %d rows for timing event %s; expected 1" %
            (count, event))

    descriptor, temporary_path = tempfile.mkstemp(
        prefix=".run-status-", suffix=".md", dir=run, text=True)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(updated)
        os.chmod(temporary_path, status_mode)
        os.replace(temporary_path, status_path)
    except Exception:
        try:
            os.unlink(temporary_path)
        except OSError:
            pass
        raise
    return status_path


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("run_folder")
    parser.add_argument("event", choices=sorted(EVENTS))
    parser.add_argument("--now", help="ISO-8601 timestamp override for tests")
    args = parser.parse_args(argv)

    timestamp = args.now or datetime.datetime.now().astimezone().replace(
        microsecond=0).isoformat()
    try:
        path = record(args.run_folder, args.event, timestamp)
    except (OSError, ValueError) as exc:
        sys.stderr.write("Could not record run timing: %s\n" % exc)
        return 1
    sys.stdout.write("%s\n" % path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
