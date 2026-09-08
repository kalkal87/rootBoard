# Board Data Translation

How `synthesis.md`'s `Structured Board Content` section becomes
`board-data.json`. This is stage 6 of `run-workflow.md`.

`contracts/synthesis-output.md` names this step and states its constraint:

> That translation must be mechanical: it must not add reasoning, resolve a
> divergence the synthesizer left open, or invent a value the synthesizer
> didn't provide.

This file is the mechanical part. Everything below is either a copy, a
concatenation, or a counter. If a rule here requires you to make a judgment
call about the analysis, the rule is wrong — stop and check whether the
synthesis is actually missing something instead.

`orchestration/scripts/translate_board_data.py` applies everything below —
run it rather than translating by hand:

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/translate_board_data.py" "<absolute-run-path>"
```

`ROOTBOARD_SKILL_ROOT` means the resolved absolute directory containing the
active `SKILL.md`. Expand the placeholder before execution; do not assume the
current working directory is the skill root.

This file stays the authority on *what the rules are*: it's what the script
was written against, what a contributor changing the script should read
first, and the fallback procedure for a coordinator translating by hand when
Python isn't available (`orchestration/scripts/README.md` covers that case).
The script does not parse arbitrary markdown — it recognizes exactly the
labeled-field shape this file and `contracts/synthesis-output.md` describe,
tolerant of ordinary line-wrapping and of the small formatting variation
real synthesizer output has shown (an em dash, en dash, or hyphen as the
Frameworks separator; "see top-level proof points" in any letter case). A
`Structured Board Content` section that drifts from that shape is a reason
for the script to stop and say exactly where, not a reason for it to guess
— see its own docstring for the precise grammar it accepts.

---

## The one thing the synthesizer left for this step

`Structured Board Content` carries the content of every card. It does not
carry `id` or `position` — the synthesizer identifies problems by working
title and does not compute canvas coordinates. Assigning those two fields is
this step's only original contribution.

---

## Field mapping

One card per `### <working title>` block in `Structured Board Content`, in
the order they appear.

| Board field | Comes from | Rule |
| --- | --- | --- |
| `id` | assigned here | `card-01`, `card-02`, … in document order, zero-padded to two digits. |
| `problem_statement` | **Problem Statement** | Verbatim. |
| `impact` | **Impact** | Verbatim. |
| `proof_points` | **Proof Points** | One array entry per listed point, verbatim. |
| `frameworks` | **Frameworks** | One object per listed framework — see below. |
| `convergence_note` | **Convergence Note** | Verbatim, confidence line included. |
| `position` | assigned here | See the layout rule below. |
| `created_by` | — | Omit. The renderer defaults it to `"agent"`. |
| `tags` | — | Omit. The synthesizer does not produce tags. |
| `frameworks[].confidence` | — | Omit. Confidence stays prose-only in `convergence_note`; the renderer parses it from there when this field is absent — see `contracts/synthesis-output.md`. |
| `tension` | — | Omit. The synthesizer does not produce this field yet — see `contracts/synthesis-output.md`. |

### The `frameworks` array

Each line under **Frameworks** reads `<Framework Name> — <that framework's
own proof points, or "see top-level proof points">`.

- `name` is the framework name as written, unchanged. Use the display name
  (`Five Whys`), not the slug.
- `proof_points` holds that framework's own points when it listed distinct
  ones. When the line says the framework contributed no distinct points, omit
  the `proof_points` key entirely — `contracts/board-output.md` makes the
  expanded view fall back to the card's top-level list, which is exactly the
  intent.

Array length is what makes a card render flat or as a fanned stack, so it
must match the synthesizer's contributing-framework list exactly. Adding a
framework here that the synthesizer did not list manufactures a convergence
the analysis never found; dropping one hides a convergence it did.

### Board-level fields

| Board field | Comes from |
| --- | --- |
| `board_title` | The run's subject, in the input's own vocabulary — the classifier's Input Summary is the best source. It becomes the page heading and the browser tab title. |
| `source_summary` | One line describing what was analyzed, e.g. `"34-minute customer discovery call, 3 lenses"`. |
| `generated_at` | The run timestamp, ISO-8601. |

---

## Position layout

Cards are laid out on a grid, left to right, four per row. The canvas is
3600×2400 and a card is 300px wide, so this leaves most of the board empty on
purpose — the user's first move is usually to drag cards into their own
grouping, and a full canvas discourages that.

```
x = 80  + (index mod 4)   * 320
y = 100 + (index div 4)   * 340
```

For a five-card board: `(80,100) (400,100) (720,100) (1040,100) (80,440)`.

Positions are a starting arrangement only. The renderer tracks drags in local
state and never writes them back, so nothing downstream depends on these
numbers. They exist so cards do not pile on top of each other on open.

---

## What never happens during translation

- **A card for something the synthesizer did not put in `Structured Board
  Content`.** A blind spot the synthesizer deliberately kept in the
  `Blind Spots` section stays there. So does a problem it excluded for
  having no traceable proof point.
- **Rewriting, sharpening, or shortening a statement.** Fields are copied. If
  a problem statement reads awkwardly, that is the synthesis to fix, not the
  JSON.
- **Resolving a divergence.** Two cards representing two sides of a tension
  the synthesizer left open stay as two cards.
- **Dropping a low-confidence problem.** Confidence rides in
  `convergence_note` precisely so it survives this step; a Low anywhere in
  that line is not a filter.
- **Inventing a proof point to fill an empty array.** If the synthesizer gave
  a card no proof points, the validator will warn — and that warning is about
  the synthesis, not the JSON.

---

## Empty and near-empty boards

An empty `Structured Board Content` translates to:

```json
{ "board_title": "…", "source_summary": "…", "cards": [] }
```

which `contracts/board-output.md` names as a valid board. It renders as an
empty canvas the user can add to. Do not pad it, and do not skip the render
stage — the user still gets an artifact, and the reason the board is empty
belongs in what you tell them, in `synthesis.md`, and in `run-status.md`.

---

## Checking the translation

```bash
python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/validate_board_data.py" "<absolute-run-path>/board-data.json"
```

`translate_board_data.py` already runs this validation itself and writes
nothing if it fails, so this is mainly useful when board data came from
somewhere else (a hand translation, a fixture). The validator catches
contract violations — a duplicate id, a missing required field, a
non-numeric coordinate, a framework entry that is a bare string. It cannot
catch a faithful-looking card that says something the synthesis does not,
and a parser can misread a card the same way a person can mistype one:
before treating a translation as final, read the card list back against
`Structured Board Content` once — same number of cards, same order, same
framework names on each.
