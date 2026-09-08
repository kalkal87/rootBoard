#!/usr/bin/env python3
"""Turn validated board data into the run's whiteboard artifact.

This is stage 7 of orchestration/run-workflow.md. It takes
renderer/board-template/index.html, inlines renderer/whiteboard/whiteboard.css,
whiteboard-core.js and whiteboard.js, and substitutes the __BOARD_DATA__ and
__SYNTHESIS_MARKDOWN__ placeholders with the run's board data and written
synthesis.

The result is a single self-contained file. The template's own includes are
relative (`../whiteboard/...`), which only resolves inside this repository --
a run folder lives in the user's Documents, and the user may well move or mail
the file. Inlining is what makes the artifact survive that. The renderer asset
files themselves are not modified; this is an assembly step, not a build step
for them.

The board data is validated first, and nothing is written if it fails. A
whiteboard that opens looking plausible but was built from broken data is the
one failure mode this stage exists to prevent.

Usage:
    build_whiteboard.py <run-folder>
    build_whiteboard.py --board-data PATH [--synthesis PATH] --out PATH

Exit codes (see contracts/runtime-errors.md):
    0  whiteboard.html written
    1  RE-10  the board data is invalid; nothing was written
    2  RE-10  the board data is missing or is not JSON
    3  RE-11  the renderer assets or template file could not be read or matched
    4  RE-11  the artifact could not be written
"""

import argparse
import html as html_module
import json
import os
import re
import sys

# The skill is installed as plain files, often via a read-only symlink; leaving
# a __pycache__ next to them is noise at best and a write failure at worst.
sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import validate_board_data as validator  # noqa: E402

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__))))
TEMPLATE = os.path.join(REPO_ROOT, "renderer", "board-template", "index.html")
CSS = os.path.join(REPO_ROOT, "renderer", "whiteboard", "whiteboard.css")
CORE_JS = os.path.join(
    REPO_ROOT, "renderer", "whiteboard", "whiteboard-core.js")
JS = os.path.join(REPO_ROOT, "renderer", "whiteboard", "whiteboard.js")

# The bare placeholders also appear in the template's explanatory comment.
# Match the assignments, not the placeholders, so that comment cannot be
# substituted by mistake.
ASSIGNMENT = "window.BOARD_DATA = __BOARD_DATA__;"
PLACEHOLDER = "__BOARD_DATA__"
SYNTHESIS_ASSIGNMENT = (
    "window.SYNTHESIS_MARKDOWN = __SYNTHESIS_MARKDOWN__;"
)
SYNTHESIS_PLACEHOLDER = "__SYNTHESIS_MARKDOWN__"
CSS_LINK = '<link rel="stylesheet" href="../whiteboard/whiteboard.css" />'
CORE_JS_TAG = '<script src="../whiteboard/whiteboard-core.js"></script>'
JS_TAG = '<script src="../whiteboard/whiteboard.js"></script>'
MOUNT_CALL = "ProblemBoard.mount"
# Asset markers inside comments do not count as active template structure, but
# they do count as duplicates so drift cannot be hidden in a comment.
HTML_COMMENT = re.compile(r"<!--.*?-->", re.S)
SCRIPT_CLOSING_PREFIX = re.compile(r"</(?=script)", re.IGNORECASE)
# The injection-point comment is guidance for whoever produces an artifact.
# It is noise inside the artifact itself.
INJECTION_COMMENT = re.compile(
    r"\n?[ \t]*<!--\s*\n\s*BOARD (?:DATA|CONTEXT) INJECTION POINT.*?-->\n?",
    re.S,
)


def escape_json_for_inline(payload):
    """Make a JSON payload safe inside a <script> block.

    `\\u003c` is a valid escape in both JSON and JavaScript, so escaping every
    `<` neutralises `</script` and `<!--` without producing anything a JSON
    parser would reject.
    """
    return payload.replace("<", "\\u003c")


def escape_js_for_inline(js):
    """Make a renderer JavaScript asset safe inside a <script> block.

    `<\\/script` is the same string to JavaScript but is not a closing tag to
    the HTML parser. `<!--` has no safe rewrite that is correct in every JS
    context, so its presence is treated as drift rather than guessed at.
    """
    if "<!--" in js:
        raise ValueError(
            "a whiteboard JavaScript asset contains an HTML comment opener "
            "(`<!--`), which cannot be safely inlined into a <script> block")
    return SCRIPT_CLOSING_PREFIX.sub(lambda _match: "<\\/", js)


def validate_template_structure(template):
    """Reject missing, inactive, duplicated, or misordered asset markers."""
    active_template = HTML_COMMENT.sub("", template)
    assets = (
        ("stylesheet", CSS_LINK),
        ("core renderer script", CORE_JS_TAG),
        ("renderer script", JS_TAG),
    )

    for asset, marker in assets:
        count = template.count(marker)
        if count != 1:
            raise ValueError(
                "the %s asset marker must appear exactly once in the original "
                "board template, but appears %d time%s (%s)"
                % (asset, count, "" if count == 1 else "s", marker))
        if active_template.count(marker) != 1:
            raise ValueError(
                "the %s asset marker must be an active tag, not inside an "
                "HTML comment (%s)" % (asset, marker))

    stylesheet = active_template.index(CSS_LINK)
    core = active_template.index(CORE_JS_TAG)
    renderer = active_template.index(JS_TAG)
    if not stylesheet < core < renderer:
        raise ValueError(
            "renderer asset order must be stylesheet, core script, then main "
            "renderer script")

    mount = active_template.find(MOUNT_CALL)
    if mount == -1:
        raise ValueError(
            "the board template no longer contains the board mount call "
            "(%s)" % MOUNT_CALL)
    if renderer > mount:
        raise ValueError(
            "the core and main renderer scripts must appear before the board "
            "mount call")


def read_text(path, what):
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return handle.read()
    except OSError as exc:
        sys.stderr.write(
            "RE-11: The whiteboard could not be built because %s could not be "
            "read (%s at %s). The run's findings, synthesis and board data are "
            "still saved.\n" % (what, exc.strerror or exc, path))
        sys.exit(3)


def build(board_data, template, css, core_js, js, synthesis_text=""):
    """Return the assembled HTML, or raise ValueError on template drift.

    Board-data substitutions happen before renderer assets are inlined. The
    three asset tags are then replaced once in dependency order.
    """
    validate_template_structure(template)
    html = template

    # 1. Board data. Match the assignment, not the bare placeholder: the
    #    placeholder also appears in the comment above it.
    if ASSIGNMENT not in html:
        raise ValueError(
            "the board template no longer contains the assignment this script "
            "substitutes (`%s`)" % ASSIGNMENT)

    html = INJECTION_COMMENT.sub("\n", html)
    payload = json.dumps(board_data, indent=2, ensure_ascii=False)
    html = html.replace(
        ASSIGNMENT,
        "window.BOARD_DATA = %s;" % escape_json_for_inline(payload), 1)

    if PLACEHOLDER in html:
        raise ValueError(
            "the board template mentions %s somewhere this script did not "
            "substitute, so the artifact would ship with a placeholder in it"
            % PLACEHOLDER)

    # 2. Written synthesis. It stays hidden in the artifact until the user
    #    chooses Copy context; encoding it as a JSON string preserves the
    #    complete markdown while keeping arbitrary source text script-safe.
    if SYNTHESIS_ASSIGNMENT not in html:
        raise ValueError(
            "the board template no longer contains the synthesis assignment "
            "this script substitutes (`%s`)" % SYNTHESIS_ASSIGNMENT)
    synthesis_payload = json.dumps(synthesis_text, ensure_ascii=False)
    html = html.replace(
        SYNTHESIS_ASSIGNMENT,
        "window.SYNTHESIS_MARKDOWN = %s;"
        % escape_json_for_inline(synthesis_payload),
        1,
    )
    if SYNTHESIS_PLACEHOLDER in html:
        raise ValueError(
            "the board template mentions %s somewhere this script did not "
            "substitute, so the artifact would ship with a placeholder in it"
            % SYNTHESIS_PLACEHOLDER)

    # 3. Title, so the browser tab and the gallery name the run.
    title = board_data.get("board_title")
    if isinstance(title, str) and title.strip():
        html = html.replace(
            "<title>Problem Board</title>",
            "<title>%s</title>" % html_module.escape(title.strip()), 1)

    # 4. The three renderer assets, inlined last.
    if CSS_LINK not in html:
        raise ValueError(
            "the stylesheet link in the board template no longer matches "
            "what this script expects (%s)" % CSS_LINK)
    html = html.replace(
        CSS_LINK, "<style>\n%s\n    </style>" % css.rstrip("\n"), 1)

    if CORE_JS_TAG not in html:
        raise ValueError(
            "the core renderer script tag in the board template no longer "
            "matches what this script expects (%s)" % CORE_JS_TAG)
    html = html.replace(
        CORE_JS_TAG,
        "<script>\n%s\n    </script>"
        % escape_js_for_inline(core_js).rstrip("\n"),
        1)

    if JS_TAG not in html:
        raise ValueError(
            "the renderer script tag in the board template no longer matches "
            "what this script expects (%s)" % JS_TAG)
    html = html.replace(
        JS_TAG,
        "<script>\n%s\n    </script>" % escape_js_for_inline(js).rstrip("\n"), 1)

    for asset, marker in (
            ("core renderer", CORE_JS_TAG), ("main renderer", JS_TAG)):
        if marker in html:
            raise ValueError(
                "the external %s script tag remained after inlining (%s)"
                % (asset, marker))

    return html


def main(argv=None):
    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("run_folder", nargs="?")
    parser.add_argument("--board-data")
    parser.add_argument("--synthesis")
    parser.add_argument("--out")
    parser.add_argument("--template", default=TEMPLATE)
    parser.add_argument("--css", default=CSS)
    parser.add_argument("--core-js", default=CORE_JS)
    parser.add_argument("--js", default=JS)
    args = parser.parse_args(argv)

    if args.run_folder:
        run = os.path.abspath(os.path.expanduser(args.run_folder))
        board_path = args.board_data or os.path.join(run, "board-data.json")
        synthesis_path = args.synthesis or os.path.join(run, "synthesis.md")
        out_path = args.out or os.path.join(run, "whiteboard.html")
    elif args.board_data:
        board_path = args.board_data
        synthesis_path = args.synthesis
        out_path = args.out or os.path.join(
            os.path.dirname(os.path.abspath(board_path)), "whiteboard.html")
    else:
        parser.error("give a run folder, or --board-data with --out")

    try:
        data = validator.load(board_path)
    except ValueError as exc:
        sys.stderr.write("RE-10: %s\nThe whiteboard was not built.\n" % exc)
        return 2

    errors, warnings = validator.validate(data)
    for warning in warnings:
        sys.stderr.write("warning: %s\n" % warning)
    if errors:
        sys.stderr.write(
            "\nRE-10: The board data in %s breaks the board contract in %d "
            "way%s, so the whiteboard was not built:\n"
            % (board_path, len(errors), "" if len(errors) == 1 else "s"))
        for error in errors:
            sys.stderr.write("  - %s\n" % error)
        sys.stderr.write(
            "\nEverything earlier in the run is still saved. Fix the board "
            "data, or the synthesis it was translated from, and re-run this "
            "step.\n")
        return 1

    template = read_text(args.template, "the board template")
    css = read_text(args.css, "the whiteboard stylesheet")
    core_js = read_text(args.core_js, "the whiteboard core module")
    js = read_text(args.js, "the whiteboard renderer")
    synthesis_text = (
        read_text(synthesis_path, "the run synthesis")
        if synthesis_path else ""
    )

    try:
        html = build(data, template, css, core_js, js, synthesis_text)
    except ValueError as exc:
        sys.stderr.write(
            "RE-11: The whiteboard could not be built -- %s. The run's "
            "findings, synthesis and board data are still saved.\n" % exc)
        return 3

    try:
        with open(out_path, "w", encoding="utf-8") as handle:
            handle.write(html)
    except OSError as exc:
        sys.stderr.write(
            "RE-11: The whiteboard could not be written to %s (%s). The run's "
            "findings, synthesis and board data are still saved.\n"
            % (out_path, exc.strerror or exc))
        return 4

    count = len(data.get("cards", []))
    stacks = sum(1 for card in data.get("cards", [])
                 if len(card.get("frameworks") or []) > 1)
    sys.stderr.write(
        "Built a whiteboard with %d card%s (%d converged stack%s), "
        "self-contained in one file.\n"
        % (count, "" if count == 1 else "s",
           stacks, "" if stacks == 1 else "s"))
    sys.stdout.write("%s\n" % out_path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
