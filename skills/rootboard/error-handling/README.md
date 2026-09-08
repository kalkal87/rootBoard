# Error Handling

What the user is told when a run doesn't go cleanly.

Ownership: Ticket 7.

## Layout

| Path | What it is |
| --- | --- |
| `voice.md` | The writing standard all twelve responses are held to — the three questions, the vocabulary that must never reach the user, and the tone. Read first. |
| `responses.md` | One user-facing response per failure point in `contracts/runtime-errors.md`. |

Worked examples of each message, with the trigger that produces it and the
reasoning behind its wording, are in `examples/failure-cases/`.
`docs/error-handling.md` is the same material written for the user rather
than for whoever is running the skill.

## How this fits with the rest

Three files divide the work, and the split is worth keeping straight:

- **`contracts/runtime-errors.md`** (Ticket 6) defines *what can go wrong,
  where, and what survives it* — twelve failure points, `RE-01` to `RE-12`,
  each with the stage it surfaces at, what is on disk when it does, and what
  must be preserved.
- **`orchestration/run-workflow.md`** (Ticket 6) says *where in the run each
  one can fire*, as the gate at the end of each stage.
- **This folder** says *what the user reads*. Nothing here re-decides what
  happened or what was saved; it takes that from the contract and turns it
  into something a person can act on.

So when a stage's gate names `RE-07`, the response for it is in
`responses.md`, and the facts it fills in — which lens, which files survived —
come from the run folder itself.

## Most of these are not errors

Seven of the twelve failure points are legitimate outcomes rather than
malfunctions: a lens that fits the input poorly, a transcript too thin to
carry much, two lenses that genuinely disagree, a user asking where an old run
went. Written as errors, they mislead — a divergence report dressed up as a
failure tells the user something is broken when the run has just done the most
useful thing it can do.

Only three stop a run outright, and all three are the input never arriving in
a readable form. Nothing in this skill destroys work.

## The bar

The separately maintained evaluation suite scores these messages and triggers
their failure cases. The scoring is unforgiving in a specific way: a message can be
accurate, complete and friendly and still score 1 for using a word like
"agent" or "schema" that the reader has no way to act on, and it scores 0
outright if a partial run is reported as a complete one.

The suite takes the **lowest** score across the probes it ran, not the
average. One bad message is what a user will hit.
