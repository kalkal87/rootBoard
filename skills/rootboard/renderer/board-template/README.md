# Board Template

The reusable browser shell for generated whiteboard artifacts: `index.html`.

It contains five assembly points:

- `../whiteboard/whiteboard.css` — renderer styles,
- `../whiteboard/whiteboard-core.js` — drag/merge core module,
- `../whiteboard/whiteboard.js` — main renderer,
- `__BOARD_DATA__` — board data inside the `window.BOARD_DATA =
  __BOARD_DATA__;` assignment.
- `__SYNTHESIS_MARKDOWN__` — the JSON-encoded contents of the run's
  `synthesis.md`, exposed to the renderer only for Copy context.

The core module must load before the main renderer.

## Producing a whiteboard artifact from this template

1. Copy `index.html` to the run's output location (see
   `docs/invocation-and-runs.md` for where a run's files live).
2. Replace the `__BOARD_DATA__` placeholder — including its surrounding
   braces — with board data shaped per `contracts/board-output.md`.
3. Replace `__SYNTHESIS_MARKDOWN__` with the JSON-encoded contents of
   `synthesis.md` (or an empty string for a renderer-only fixture).
4. The copied file is now a self-contained (aside from its three relative
   `whiteboard/` includes) whiteboard artifact. Opening it in a browser
   renders the board.

The source repository's development fixture `examples/renderer-fixtures/`
contains a worked example of this substitution. It is intentionally outside
the distributed skill package.
