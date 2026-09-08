# Renderer

This folder contains the interactive whiteboard artifact and the reusable
rendering logic that turns synthesized problem data into that artifact.

Ownership: Ticket 2.

## Layout

- **`whiteboard/`** — the core rendering + interaction logic
  (`whiteboard-core.js`, then `whiteboard.js`, plus `whiteboard.css`). The core
  module must load before the main renderer. The renderer is
  framework-agnostic: it reads board data shaped per
  `contracts/board-output.md` and knows nothing about how that data was
  produced.
- **`board-template/`** — the reusable browser shell
  (`index.html`) that includes the whiteboard files and mounts them. A run
  becomes a whiteboard artifact by replacing this file's `__BOARD_DATA__`
  placeholder with real board data and `__SYNTHESIS_MARKDOWN__` with the
  JSON-encoded written synthesis.

## How it fits together

1. Something upstream (the synthesizer, or a hand-written fixture) produces
   board data conforming to `contracts/board-output.md`.
2. `board-template/index.html`'s `__BOARD_DATA__` placeholder is replaced
   with that data, and `__SYNTHESIS_MARKDOWN__` is replaced with the complete
   written synthesis. The resulting file is the run's final whiteboard
   artifact — self-contained aside from its three relative `whiteboard/`
   assets: `whiteboard.css`, `whiteboard-core.js`, then `whiteboard.js`.
3. Opening that file in a browser renders the board and enables the V1 card
   interactions (add, edit, move, delete, duplicate, and drag-and-hold merge)
   entirely in local browser state — nothing is written back to disk. Copy
   context puts a chatbot-ready prompt plus the embedded synthesis on the
   clipboard. Add is the first compact side-rail tool; there are no
   top-toolbar Add or Merge buttons.

The source repository keeps a development-only worked fixture at
`examples/renderer-fixtures/`; it is intentionally outside this distributed
skill package.

## Design notes

- No build step, no external dependencies, no fetch of local files (so
  fixtures and generated artifacts open correctly straight from `file://`).
- Convergence (a "stack" of sticky notes) is derived purely from how many
  entries a card's `frameworks` array has — see
  `contracts/board-output.md` for why there is no separate stack-membership
  field.
