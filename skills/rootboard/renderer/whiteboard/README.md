# Whiteboard Renderer

The interactive sticky-note whiteboard: `whiteboard-core.js`,
`whiteboard.js`, and `whiteboard.css`. The core module must load before the
main renderer.

## Usage

```html
<link rel="stylesheet" href="whiteboard.css" />
<div id="board-root"></div>
<script>
  window.BOARD_DATA = {
    /* board data shaped per contracts/board-output.md */
  };
  window.SYNTHESIS_MARKDOWN = "# Synthesis\n\n...";
</script>
<script src="whiteboard-core.js"></script>
<script src="whiteboard.js"></script>
<script>
  ProblemBoard.mount(
    window.BOARD_DATA,
    document.getElementById("board-root"),
    { synthesisMarkdown: window.SYNTHESIS_MARKDOWN }
  );
</script>
```

`ProblemBoard.mount(data, rootElement, options)` renders the toolbar and canvas
into `rootElement` and wires up all interactions. Pass the original
`synthesis.md` as `options.synthesisMarkdown` to enable Copy context. It is
the only entry point the file exposes.

## What it does not do

- It does not fetch data itself — the host page must set `window.BOARD_DATA`
  before calling `mount`.
- It does not persist card, label, or canvas edits. Positions, text edits,
  labels, and added/deleted/merged/duplicated cards live only in memory for
  the life of the page. The board title is the one exception: a user rename
  is stored in the browser for that specific board and restored after reload.
- It does not know which problem-solving framework produced a card, or
  contain any framework-specific reasoning — it only reads the `frameworks`
  array to decide whether a card is a flat card or a fanned stack.

## Interactions implemented

- **Rename board** — click the board title in the top bar and type. Enter or
  moving focus away saves the single-line name; Escape cancels the current
  edit. The browser-tab title updates with the saved name, which is restored
  from browser storage when the same board reloads.
- **Copy context** — copies a paste-ready AI discussion prompt followed by the
  complete original `synthesis.md`. The synthesis is embedded in generated run
  artifacts and is not displayed in the board. In-memory card and title edits
  do not rewrite that source synthesis.
- **Add** — the first compact tool in the permanent side rail creates a
  blank, user-authored card in the currently visible part of the canvas. Add
  and Merge are not top-toolbar buttons; merging is a direct drag gesture.
- **Text label** — the T tool beside Add, or the `T` keyboard shortcut, creates
  a lightweight label in the visible canvas and immediately opens it for
  editing. Enter commits a single-line label, Escape cancels the current edit,
  and an empty label is removed when editing ends. Labels drag independently,
  remain visible during Focus, and never participate in card merging or theme
  zones. The shortcut is ignored while any editable text field has focus.
- **Edit** — click into the problem statement, impact, or any proof point to
  edit in place; add/remove individual proof points.
- **Move** — drag a card anywhere on the canvas.
- **Pan** — drag any empty canvas area with a mouse to scroll the board.
  Native scrolling with the scrollbar, trackpad, wheel, or touch continues
  to work, including while Focus is active.
- **Zoom** — the bottom-right +/− control, or Ctrl/Cmd + wheel (also how
  browsers report trackpad pinch). Clicking the percentage resets to 100%.
  Ranges 25%–200%; the point under the cursor (or the canvas center, for
  the buttons) stays fixed as the zoom level changes.
- **Delete** — per-card button.
- **Duplicate** — per-card button; clones the card (including its
  `frameworks`) into a second, independent card offset slightly from the
  original.
- **Merge** — drag the source card until its center is over the target card,
  then keep holding for 1.5 seconds while the target's compact halo/progress
  fills. Moving the source away or releasing early cancels the merge. On
  completion the renderer creates a deterministic draft automatically, then
  immediately focuses its problem statement for editing. The card under the
  source is the target: its position and main theme stay first, followed by
  target-first combinations of the problem statement, impact, proof points,
  lenses (`frameworks`), convergence note, and tags; tension is retained if
  either input has it. Duplicate content is removed by fixed normalization
  rules documented in `contracts/board-output.md`; this is not an AI rewrite.
  There is no separate merge mode or two-card click selection.
- **Proof points** — an always-present, full-width disclosure row opens the
  card's editable evidence and existing add/remove controls. It starts
  collapsed; click, Enter, or Space toggles it.
- **Lens & confidence** — a second disclosure row appears when framework or
  convergence data exists. It starts collapsed and reveals framework names,
  framework-specific proof points, normalized textual confidence, and the
  synthesizer's `convergence_note`. Both single- and multi-lens cards can show
  this row; only multi-lens cards get physical stack layers.
  The two disclosures are independent, grow to their content's natural height,
  and remember their state only for the current board instance. Focus-selectable
  and Focus-dimmed cards disable both disclosures. Selected Focus cards keep
  them enabled and editable.
- **Toggle theme zones** — the Zones button on the permanent side panel
  (left edge of the canvas). On by default. Draws a soft, labeled
  background region behind each cluster of related cards, computed
  client-side per "How theme zones work" in `contracts/board-output.md`.
  Off just hides the zones; it doesn't change card positions.
- **Focus cards** — the Focus button on the side panel starts a live,
  same-canvas selection with no confirmation step or maximum set size. With
  no focused cards, every card stays at full opacity as a selection-only
  target. After the first selection, focused cards stay raised and fully
  interactive while the others dim but remain selectable by click, Enter,
  or Space. A subtle per-card control removes a focused card from the set,
  and the toolbar can clear the full set. Focus never gathers or rearranges
  cards; edits and moves made to focused cards are normal in-memory board
  changes and remain after Focus exits.
  - The focused set is remembered when Focus is toggled off and restored if
    Focus is re-entered in the same tab. Reloading the artifact resets it
    along with the board's other in-memory changes.
  - Adding a card while Focus is active adds the new card to the set.
    Duplicating a focused card while Focus is active adds its copy. Add and
    duplicate operations performed while Focus is off do not expand the
    remembered set.
  - Deleting a focused card removes it from the set. Removing the final
    focused card leaves Focus active in the full-opacity selection state;
    deleting the board's final card exits Focus, clears the set, and disables
    the Focus button until another card exists.
  - A merged card inherits focus membership when either source was focused
    or remembered, whether Focus is on or off; otherwise the result is not
    focused. While Focus is active, only focused cards can be dragged,
    edited, duplicated, deleted, expanded, or used as a merge source or
    target; dimmed cards stay inert except for click or keyboard focus
    selection. Focus-selectable and dimmed cards keep disclosures disabled,
    while selected focused cards keep them enabled and editable.
    Add and Clear remain available. Changing Focus, clearing the set,
    zooming, panning, or rebuilding the board cancels unfinished
    drag-merge feedback or completion so stale DOM cannot finish a merge.
  - Theme zones are hidden temporarily while Focus is active. Leaving Focus
    restores the user's prior zone setting.
    Empty-canvas pan and all zoom controls remain available without leaving
    Focus.

## Passive signals (no click required)

The 300px stickies use an editorial hierarchy: Confidence first, the problem
statement as the dominant headline, Impact as visible secondary copy, and the
two disclosure rows below. Four shuffled color waves assign one of each wave
per four-card cycle; assignments stay stable for the board instance and
reshuffle only on reload. The folded corner uses one solid tint from its
assigned wave.

Three things read at a glance, without opening either disclosure — the exact
derivation rules live in `contracts/board-output.md`'s "How confidence and
tension render":

- **Convergence weight** — the fanned stack gets visibly deeper (more
  layers, heavier shadow) the more frameworks converged. There is no text
  badge restating the count; the stack's own silhouette is the signal.
- **Confidence** — a "Confidence" label and a row of dots, one per
  contributing framework, each dot's fill showing that framework's own
  confidence (solid/half-filled/hollow/dashed for High/Medium/Low/not
  stated). No textual level word appears on the collapsed card face.
- **Tension** — a card whose lenses have an unresolved disagreement about
  part of the problem (`tension: true`) gets the global dashed bottom edge,
  independent of its color wave and of how strongly it converged.
