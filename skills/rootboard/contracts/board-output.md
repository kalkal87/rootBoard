# Board Output Contract

This is the data format the renderer consumes. Anything that produces a
whiteboard — the synthesizer, a hand-written fixture, a future importer —
must emit JSON shaped like this. The renderer does not know or care which
framework produced a card; it only reads this structure.

The renderer never edits this file format. It reads one JSON object once, at
load time, and keeps everything else in local browser state.

## Top-level object

```json
{
  "board_title": "Why onboarding activation dropped in Q3",
  "generated_at": "2026-08-25T14:30:00Z",
  "source_summary": "45-minute team retro transcript about the Q3 activation dip",
  "cards": [ /* Card objects, see below */ ]
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `board_title` | optional | string | Shown as the page heading. Falls back to a generic title if omitted. |
| `generated_at` | optional | string (ISO-8601) | Informational only; not shown prominently. |
| `source_summary` | optional | string | Informational metadata; not rendered in the whiteboard chrome. |
| `cards` | required | array of Card | May be empty (an empty board is valid — the user can still Add). |

## Card object

```json
{
  "id": "card-01",
  "problem_statement": "Users abandon onboarding at the integration step, not the signup step.",
  "impact": "Activation dropped 18% in Q3 even though signups held steady, which is masking the real problem as a top-of-funnel issue.",
  "proof_points": [
    "3 of 5 churned accounts in the transcript stalled at 'connect your data source'.",
    "Support tickets tagged 'setup' rose 40% quarter over quarter."
  ],
  "frameworks": [
    {
      "name": "Jobs to Be Done",
      "proof_points": [
        "Users describe the integration step as 'someone else's job', suggesting a handoff gap."
      ],
      "confidence": "High"
    },
    {
      "name": "Funnel Analysis",
      "proof_points": [
        "3 of 5 churned accounts in the transcript stalled at 'connect your data source'."
      ],
      "confidence": "High"
    }
  ],
  "position": { "x": 420, "y": 180 },
  "convergence_note": "Confidence: Jobs to Be Done High; Funnel Analysis High. Both lenses independently pointed at the integration step rather than signup, despite the team framing this as a signup problem.",
  "created_by": "agent",
  "tags": ["activation", "onboarding"],
  "tension": false
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | required | string | Unique within the board. Immutable once created. |
| `problem_statement` | required | string | The reframed problem statement. Editable card field. |
| `impact` | required | string | Impact/symptoms text — why it matters, how it's showing up. Editable card field. |
| `proof_points` | required | array of string | The curated evidence exposed by the card's Proof points disclosure. May be an empty array. Editable card field. |
| `frameworks` | required | array of Framework | The lenses that surfaced this problem. May be an empty array (see below). Not directly text-edited; changes only as a side effect of merge/duplicate. |
| `position` | required | object `{x, y}` | Initial canvas coordinates (numbers). The renderer treats this as a starting position only — dragging updates it in local state, not in this file. |
| `convergence_note` | optional | string | Short synthesizer note on why frameworks agreed or disagreed. Shown in the Lens & confidence disclosure. |
| `created_by` | optional | string: `"agent"` or `"user"` | Defaults to `"agent"` if omitted. The renderer sets this to `"user"` for cards created or duplicated in-browser. |
| `tags` | optional | array of string | Free-form labels. When present on at least one card, the renderer groups cards into theme zones by each card's first tag (see "How theme zones work" below); otherwise still reserved for future filtering. |
| `tension` | optional | boolean | Whether contributing lenses have an unresolved disagreement about part of this problem (as opposed to simply not converging — see "How confidence and tension render" below). Defaults to `false`/not-tense if omitted. No prose fallback: unlike confidence, tension is not inferred from `convergence_note` text. |

### Framework object (within `frameworks`)

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | required | string | The framework/lens name, e.g. `"Jobs to Be Done"`. |
| `proof_points` | optional | array of string | Evidence specific to this framework's independent finding, shown in Lens & confidence. If omitted, the disclosure falls back to the card's top-level `proof_points`. |
| `confidence` | optional | string: `"High"`, `"Medium"`, or `"Low"` (case-insensitive) | This framework's own confidence in its finding. If omitted, the renderer falls back to parsing a "`<name> <Level>`" match out of the card's `convergence_note` (see below) before treating it as not stated. |

## How convergence and stacking work

Convergence is not a separate object — it is derived directly from
`frameworks.length` on a single card:

- `frameworks` has **0 or 1** entries → the card renders as a **flat single
  card**.
- `frameworks` has **2 or more** entries → the card renders as a **fanned
  stack**, because multiple independent lenses converged on the same
  underlying problem.

Both single- and multi-framework cards can expose Lens & confidence. Opening
it shows each framework's name and own `proof_points` (or the card-level
`proof_points` if a framework did not provide its own), normalized textual
confidence, and the convergence note. Only multi-framework cards receive the
physical stack layers.

An empty `frameworks` array is valid and expected for a card the user adds
manually on the canvas — it did not come from any framework.

There is no separate stack-membership field (like a shared `stack_id`)
because a "stack" in this model is one problem card with multiple
contributing frameworks, not multiple physical cards glued together. This
keeps merge/duplicate simple: merging two cards means combining their
`frameworks` arrays into one card; duplicating a card means cloning it,
`frameworks` included, into two independent cards.

## How confidence and tension render

Two more signals render directly on the card face, both intentionally
subtle — neither is a legend-requiring dashboard element, and both degrade
gracefully when a producer doesn't set them:

- **Confidence** is a labeled row of dots above the problem statement, one
  dot per contributing framework (up to 4; a 5th-and-beyond framework adds
  a "+N" instead of more dots). Each dot's own fill is that framework's
  confidence: solid = High, half-filled = Medium, a hollow ring with a
  small center = Low, a dashed outline = not stated. A framework's level
  comes from its own `confidence` field; if that's absent, the renderer
  parses it out of the card's `convergence_note`, matching a
  "`<framework name> <Low|Medium|High>`" pattern — the same prose format
  `contracts/synthesis-output.md` already requires as its confidence line.
  Producers may rely on either path; setting the structured field is never
  required, only preferred where precision matters.
- **Tension** is the universal dashed bottom edge on the note when
  `tension` is `true`. It has no prose
  fallback — it exists only because a producer set it explicitly — and it
  is independent of convergence: a card can have `tension: true` with
  three strongly-converging frameworks (they agree on the problem but
  disagree on some aspect of it) just as easily as with two.

Neither signal has a separate on/off badge or legend; both are meant to be
read the same way `frameworks.length` already is — by seeing enough cards
on one board to learn the pattern, not by looking anything up.

For cards with at least one framework, the collapsed card face shows Confidence
and its dots without a visible High, Medium, or Low word. Detailed textual
levels remain available through accessible dot labels and in the expanded Lens
& confidence disclosure.

## How theme zones work

The renderer can draw soft, labeled background regions ("theme zones")
behind clusters of related cards, toggleable from a permanent side panel and
purely a client-side, in-browser computation — it is never part of this JSON
and never produced by the synthesizer:

- If any card has a non-empty `tags` array, cards are grouped by each card's
  **first** tag (case-insensitive). A card with no tags sits outside every
  zone.
- If no card has any tags at all, the renderer falls back to grouping cards
  by keyword overlap across `problem_statement` and `impact` — a heuristic,
  not a semantic model, since the renderer has no build step and makes no
  network calls.
- A group of fewer than two cards is not a zone. One card sharing no theme
  with any other card is just a card.

Producers are not required to set `tags` for this to work, but a producer
that already knows a good thematic grouping (the synthesizer, a hand-written
fixture) can set each card's `tags[0]` to get exactly that grouping instead
of leaving it to the keyword fallback.

## Editable card fields

The renderer lets the user edit, in place, on any card:

- `problem_statement`
- `impact`
- `proof_points` (add/edit/remove individual entries)

`position` changes via drag, not text editing. `id`, `frameworks`, and
`convergence_note` are not directly text-editable by the user in V1 — they
change only as a side effect of Add, Duplicate, Merge, or Delete.

## In-browser Add contract

Add is a renderer-only, in-memory operation; it does not add requirements for
board-data producers. The renderer creates a new user-authored card in the
visible viewport with a new unique `id` and these initial values:

```json
{
  "problem_statement": "New problem",
  "impact": "",
  "proof_points": [],
  "frameworks": [],
  "created_by": "user",
  "tags": []
}
```

The empty `frameworks` and `tags` arrays are intentional: a newly added card
is lensless and untagged until later in-browser actions change it. Its
position is local scratch-surface state like every other card position.

## In-browser drag-merge contract

Drag-merge is also a renderer-only, in-memory operation. The dragged card is
the **source**; the card under the source card's center is the **target**.
Holding that overlap for 1.5 seconds completes the merge. Moving away or
releasing early cancels it. Completion replaces both inputs with one editable,
deterministic draft and immediately focuses the draft's problem statement.
It is not an AI rewrite.

The draft follows these target/source rules exactly:

- `id` is a new unique card ID, and `created_by` is `"user"`.
- `position` is the target position.
- `problem_statement` is target-first. Each side is trimmed and internal
  whitespace is collapsed. For deduplication, comparison is case-insensitive
  and ignores trailing periods, question marks, and exclamation points; a
  duplicate keeps the target wording. Distinct statements are joined with a
  semicolon after removing trailing `.`, `?`, `!`, `;`, or `:` from the
  target, and the source receives a final period only when it has no final
  `.`, `?`, or `!`. If both are blank, the result is `"Untitled problem"`.
- `impact` combines target then source, omitting a blank side. Comparison for
  deduplication trims and collapses whitespace, ignores case, and ignores
  trailing periods, question marks, and exclamation points. A duplicate keeps
  the target wording; distinct text is joined with one separating space.
- `proof_points` contains target entries followed by source entries. Entries
  are trimmed and blank entries are dropped. Deduplication ignores case and
  collapsed-space differences, while punctuation remains significant; the
  first display wording is retained.
- `frameworks` (lenses) preserves target order, then appends distinct source
  frameworks in source order. Names match after trimming, lowercasing, and
  collapsing whitespace. For matching frameworks, the target name is kept;
  explicit proof-point arrays merge target then source using the same
  trimmed/nonblank/case-and-collapsed-space deduplication as card proof points.
  If only one side has a proof-point array, that normalized array is used; if
  neither side has one, `proof_points` remains `null`. Confidence stays the
  target confidence when present, otherwise uses source confidence, otherwise
  remains `null`.
- `convergence_note` combines target then source under the same blank,
  comparison, and target-first deduplication rules as `impact`.
- `tension` is `true` when either input has `tension: true`; otherwise it is
  `false`.
- `tags` contains target tags followed by source tags, with trimmed blank tags
  removed and duplicates eliminated case-insensitively after collapsing
  whitespace. The first tag therefore keeps the target's main theme when the
  target has one. Punctuation remains significant.

## Minimal valid board

```json
{ "cards": [] }
```

## Validation notes for producers

- Every `id` must be unique within `cards`.
- `position.x` and `position.y` must be finite numbers. The renderer does not
  clamp them to a canvas size; give cards enough spread that they don't all
  land on top of each other.
- `proof_points` arrays (card-level and per-framework) may be empty, but
  prefer at least one entry per card where the source material supports it —
  proof points are what make a card trustworthy to the user.
