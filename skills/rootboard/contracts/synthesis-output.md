# Synthesis Output Contract

This is the shared agreement for `synthesis.md`, the file the synthesizer
produces. It defines the exact document shape and, critically, the exact
relationship between `synthesis.md` and `contracts/board-output.md` — the
JSON the renderer actually consumes. `prompts/synthesizer.md` owns *how the
synthesizer thinks*; this file owns *the shape of what it hands back*, the
same split `contracts/agent-findings.md` has with
`prompts/problem-solving-agent.md`.

Ownership: Ticket 5.

## One file, two audiences

`synthesis.md` is a single markdown document with two parts:

1. **Prose sections** (`Reframed Problem Statement(s)`, `Convergence`,
   `Divergence`, `Blind Spots`, `Coverage Note`) — written for the user to
   read directly, before they ever look at the board. This is where the
   reasoning lives: why a convergence is meaningful, why a divergence is
   left open, why a blind spot is credible.
2. **`Structured Board Content`** — the same underlying analysis, broken
   into discrete, labeled fields, written for a later translation step
   rather than for the user to read as prose.

Both parts are produced from the same pass of analysis and must never
diverge from each other. Structured Board Content is not a second, separate
synthesis — it is a mechanical re-expression of facts already established in
the prose sections above it.

## Relationship to `contracts/board-output.md`

`Structured Board Content` is **not** the JSON `contracts/board-output.md`
defines. It is a human-and-agent-readable staging area that a later step in
the run (the orchestration workflow that assembles the run folder) reads and
translates into that JSON, one card per synthesized problem. That
translation must be mechanical: it must not add reasoning, resolve a
divergence the synthesizer left open, or invent a value the synthesizer
didn't provide. If the synthesizer's output is missing something
`board-output.md` requires, that is a gap to flag in the Coverage Note at
synthesis time — not something to patch during translation.

That translation is performed by
`orchestration/scripts/translate_board_data.py`, which parses this section
rather than reads it — so the shape below (the exact field labels, the
`<Name> — <content>` form of each `Frameworks` entry, the "see top-level
proof points" phrase) is a grammar the script matches, not just a
convention for a human reader. The parser tolerates a value wrapping across
several lines, and reads an em dash, en dash, or hyphen interchangeably as
the `Frameworks` separator — but a synthesizer producing something the
parser can't confidently match stops the run rather than guessing at it, so
staying inside this shape is what keeps a run from stalling one step short
of the board. See that script's own docstring for the precise grammar it
accepts. The source repository's
`tests/python/test_translate_board_data.py` covers that grammar, including
both worked examples below.

### Field mapping

| `Structured Board Content` field | `board-output.md` Card field | Notes |
|---|---|---|
| Reframed Problem Statement (per problem) | `problem_statement` | Carried across unchanged — see "Problem Statement shape" below. |
| Impact / Symptoms | `impact` | Faithfully compressed to the sticky-note shape below. |
| Proof Points (top-level, curated) | `proof_points` | Carried across unchanged. |
| Contributing framework(s) + each one's own proof points | `frameworks[]` | One entry per contributing framework; a problem with exactly one contributing framework is valid and simply won't render as a stack. |
| Convergence / divergence / confidence note | `convergence_note` | See "Confidence's structured field is optional" below — confidence is folded in here at minimum. |
| — | `position` | Not the synthesizer's concern. The synthesizer does not compute canvas coordinates; the translation step assigns them (or the renderer's own default layout does). |
| — | `id` | Assigned during translation. The synthesizer identifies problems by working title, not by an `id` it invents. |
| — | `created_by` | Defaults to `"agent"` per `board-output.md`; the synthesizer does not need to set this explicitly. |
| — | `tags` | Optional and not currently produced by the synthesizer; leave unset unless a future revision of this contract adds a source for tags. |
| — | `frameworks[].confidence`, `tension` | Optional renderer-side fields (see below); not currently produced by the synthesizer. |

### Problem Statement shape

The Problem Statement carried into `problem_statement` is a sticky-note
headline, not a miniature analysis. It must be exactly one sentence,
targeting 15–22 words and never exceeding 30. In substance it names three
things:

- the affected actor or system,
- the outcome that's blocked or degraded,
- the root mechanism causing it.

This is a semantic requirement, not a fixed sentence template — natural
phrasing that folds the three components together in whatever order reads
best is preferred over forcing every card through the same connectors.
Literal use of "struggles to" or "because" is illustrative, not mandatory.

Impact does not belong in the Problem Statement merely to make the sentence
feel complete: it belongs in `Impact`. Evidence belongs in `Proof Points`.
Confidence and convergence detail — including why a problem is uncertain —
belongs in the `Convergence Note`. If the problem itself is uncertain, one
calibrated qualifier ("may," "appears to") in the statement is appropriate;
a longer explanation of that uncertainty is not.

The prose `Reframed Problem Statement(s)` entry and the `Structured Board
Content` entry for the same problem must match verbatim — see "What must
always be present" below.

### Impact shape

The final Impact carried into `impact` is one consultant-style consequence
sentence, targeting 12–20 words and never exceeding 24. It answers: **What
business or operating outcome gets worse if this problem continues?** Lead
with the primary supported consequence — lost time or capacity, delayed
value, weaker performance or conversion, revenue or service risk, or poorer
decision quality — and quantify it when the findings allow. When several
frameworks contribute different symptoms, the synthesizer selects the most
decision-relevant consequence instead of concatenating their wording.

Impact is not a second Problem Statement: the Problem Statement explains the
underlying mechanism, while Impact states the concrete consequence. It does
not restate the cause, summarize stakeholder behavior, or list Proof Points.
Supporting evidence belongs in `Proof Points`; confidence and the explanation
of uncertainty belong in the `Convergence Note`. If the findings support only
an observed symptom and not a downstream consequence, state the symptom
plainly rather than manufacturing an impact. Compression must remain faithful
to the source findings and must never invent a consequence.

### Confidence's structured field is optional

Per the owner's approved standard (`examples/synthesizer/interview-notes.md`,
topic 7), a low-confidence problem must still reach the board, and
confidence must be visibly carried forward — never silently dropped. The
synthesizer's required mechanism for that is still the prose line: fold
confidence into `convergence_note` as an explicit leading line, e.g.:

```
Confidence: Five Whys Medium; Jobs to Be Done High. Strong convergence — all
three assigned frameworks independently identified the same underlying gap...
```

If frameworks disagree about their own confidence in the same underlying
problem, report each framework's confidence separately rather than
collapsing them into one number — the disagreement is itself informative,
per the same interview topic.

`contracts/board-output.md`'s Framework object now also defines an
*optional* `confidence` field, which the renderer prefers when present and
otherwise derives by parsing this same prose line — so nothing above
changes for the synthesizer. Setting the structured field is not required
and this document does not ask for it: the owner's approved standard covers
the prose line only, and changing what the synthesizer must produce is a
separate decision for a future revision of that standard, not something to
drift into here. The synthesizer must still note the prose-only nature of
confidence in its Coverage Note, exactly as before — the optional
structured field doesn't retire that requirement, since the synthesizer
itself still only ever produces the prose form.

### Tension is not currently produced

`contracts/board-output.md` also defines an optional card-level `tension`
boolean, which drives a distinct visual treatment for a card whose
contributing frameworks agree on the underlying problem but have an
unresolved disagreement about part of it (the kind of tension
`scenario-strong/synthesis.md` describes in its Convergence Note without
any board-data field to carry it). There is no prose-parsing fallback for
it — unlike confidence, it can only be set explicitly. The synthesizer does
not set it today; doing so is future work for the same reason confidence's
structured field is: it would change what the synthesizer is required to
produce, which needs its own owner-approved decision rather than a quiet
addition here.

## Required shape

```markdown
# Synthesis

## Reframed Problem Statement(s)
## Convergence
## Divergence
## Blind Spots
## Structured Board Content
## Coverage Note
```

See `prompts/synthesizer.md` for what belongs in each prose section. For
`Structured Board Content`, repeat this block once per synthesized problem:

```markdown
### <short working title>
- **Problem Statement:** <matches the corresponding entry in the Reframed
  Problem Statement(s) section above, verbatim>
- **Impact:** <one consultant-style consequence sentence targeting 12–20
  words and never more than 24; lead with the supported business or
  operating outcome that gets worse>
- **Proof Points:** <curated list, each traceable to a source finding>
- **Frameworks:**
  - <Framework Name> — <this framework's own proof points for this problem,
    or "see top-level proof points" if it didn't contribute distinct ones>
  - <...>
- **Convergence Note:** <confidence line, then the agreement/tension note —
  see "Confidence's structured field is optional" above>
```

## What must always be present

For every entry in `Structured Board Content`:

- A Problem Statement and Impact — never blank.
- The Problem Statement is exactly one sentence (target 15–22 words, hard
  maximum 30) that names, in substance, the affected actor or system, the
  blocked or degraded outcome, and the root mechanism — see "Problem
  Statement shape" above.
- Impact is exactly one sentence targeting 12–20 words, with a hard maximum
  of 24. It leads with the clearest observable consequence or strongest
  quantified signal and follows the separation rules in "Impact shape"
  above.
- At least one Proof Point. A problem with zero traceable proof points does
  not belong in `Structured Board Content` at all (see
  `prompts/synthesizer.md` Failure behavior) — it should never reach this
  section only to be given an empty `proof_points` list.
- At least one contributing framework, with that framework's own proof
  points if it has any distinct from the top-level list.
- A Convergence Note that includes the confidence line, even when only one
  framework contributed (state that framework's confidence plainly).

## What is intentionally never in `Structured Board Content`

- Full reasoning prose. Why a convergence is meaningful or why a divergence
  is left unresolved belongs in the `Convergence` / `Divergence` sections
  above — `Structured Board Content` gets a short pointer, not the argument.
- A blind spot that hasn't been promoted to a synthesized problem. Blind
  spots that rest on connecting observations across documents rather than a
  framework's own verified Problem entry stay in the `Blind Spots` section
  only — see `examples/synthesizer/scenario-strong/synthesis.md` for a
  worked instance of this restraint.
- Anything not already stated, in substance, somewhere in the prose sections
  above it.

## Minimal valid output

A run where no framework produced any traceable problems still produces a
complete `synthesis.md`: every prose section present, `Structured Board
Content` empty, and the `Coverage Note` explaining why. This mirrors the
minimal valid board in `contracts/board-output.md` (`{ "cards": [] }`) — an
empty result is a legitimate, informative output, not a malformed one.
