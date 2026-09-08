#!/usr/bin/env python3
"""Emit the compact framework metadata used during lens selection.

The framework files remain the source of truth. This helper extracts only
the fields the coordinator needs before dispatch, so classification does not
load every framework recipe into context.

Usage:
    framework_catalog.py
    framework_catalog.py --frameworks-dir /path/to/frameworks
"""

import argparse
import json
import os
import re
import sys

REQUIRED_FIELDS = ("name", "slug", "good_for", "when_to_use")
BLIND_SPOT_RE = re.compile(
    r"^## Known blind spot\s*$\n(.*?)(?=^##\s|\Z)",
    re.MULTILINE | re.DOTALL)


def parse_framework(path):
    with open(path, "r", encoding="utf-8") as handle:
        text = handle.read()

    if not text.startswith("---\n"):
        raise ValueError("%s has no YAML frontmatter" % path)
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("%s has unterminated YAML frontmatter" % path)

    fields = {}
    for line in text[4:end].splitlines():
        if not line.strip():
            continue
        if ":" not in line:
            raise ValueError("%s has malformed frontmatter: %s" %
                             (path, line))
        key, value = line.split(":", 1)
        fields[key.strip()] = value.strip()

    missing = [field for field in REQUIRED_FIELDS if not fields.get(field)]
    if missing:
        raise ValueError("%s is missing required frontmatter: %s" %
                         (path, ", ".join(missing)))

    match = BLIND_SPOT_RE.search(text[end + 5:])
    if not match:
        raise ValueError("%s has no Known blind spot section" % path)
    blind_spot = " ".join(match.group(1).split())
    if not blind_spot:
        raise ValueError("%s has an empty Known blind spot section" % path)

    return {
        "name": fields["name"],
        "slug": fields["slug"],
        "good_for": fields["good_for"],
        "when_to_use": fields["when_to_use"],
        "blind_spot": blind_spot,
    }


def build_catalog(frameworks_dir):
    paths = sorted(
        os.path.join(frameworks_dir, name)
        for name in os.listdir(frameworks_dir)
        if name.endswith(".md") and name.lower() != "readme.md")
    if not paths:
        raise ValueError("no framework files found in %s" % frameworks_dir)

    catalog = [parse_framework(path) for path in paths]
    slugs = [item["slug"] for item in catalog]
    duplicates = sorted(slug for slug in set(slugs) if slugs.count(slug) > 1)
    if duplicates:
        raise ValueError("duplicate framework slugs: %s" %
                         ", ".join(duplicates))
    return sorted(catalog, key=lambda item: item["slug"])


def main(argv=None):
    default_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.abspath(__file__)))), "frameworks")
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--frameworks-dir", default=default_dir)
    args = parser.parse_args(argv)

    try:
        catalog = build_catalog(os.path.abspath(
            os.path.expanduser(args.frameworks_dir)))
    except (OSError, ValueError) as exc:
        sys.stderr.write("Could not build framework catalog: %s\n" % exc)
        return 1

    json.dump({"frameworks": catalog}, sys.stdout, indent=2,
              ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
