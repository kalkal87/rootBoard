# Renderer Fixtures

A small, hand-written board-data example used to build and manually test the
whiteboard renderer, independent of any real analysis pipeline.

- **`sample-board.json`** — the raw board data, shaped per
  `skills/rootboard/contracts/board-output.md`. Use this as the reference example when
  producing real board data.
- **`sample-board.html`** — the same data already mounted in the whiteboard
  renderer, ready to open directly in a browser. It is
  `skills/rootboard/renderer/board-template/index.html` with the `__BOARD_DATA__` placeholder
  replaced by the JSON above (data embedded inline rather than fetched, so it
  opens correctly over `file://` with no local server). Its relative assets
  load in dependency order: `whiteboard.css`, `whiteboard-core.js`, then
  `whiteboard.js`. This renderer-only fixture has no synthesis payload, so it
  intentionally does not show the run-only Copy context action.

## What the fixture demonstrates

- The four supplied cards display one complete shuffled color-wave cycle.
- `card-01` and `card-04` are **converged stacks** (2 and 3 contributing
  frameworks), while `card-02` and `card-03` are **flat, single-framework
  cards**. Use both forms to inspect physical stack layers and confidence
  fallback.

## Try it

Open `sample-board.html` directly in a browser and test the V1 interactions:
use the first compact side-rail tool to add a card, edit any field in place,
drag a card to a new position, duplicate a card, delete a card, and merge two
cards by dragging the source until its center is over the target and holding
for 1.5 seconds. Moving away or releasing early cancels the merge; there is no
Merge button or click-selection mode. Open Proof points and Lens & confidence
independently and
verify that each panel grows to its content's natural height.
