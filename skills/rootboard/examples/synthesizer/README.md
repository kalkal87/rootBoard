# Synthesizer Examples

Two complete, worked runs demonstrating the synthesizer standard recorded in
`interview-notes.md` and implemented in `prompts/synthesizer.md` /
`contracts/synthesis-output.md`. Each folder contains the findings documents
a set of problem-solving agents would have produced (following
`contracts/agent-findings.md`) and the `synthesis.md` the synthesizer
produces from them (following `contracts/synthesis-output.md`).

Across both scenarios, every Impact is a single 12–20-word sentence. Each
leads with the clearest consequence or quantified signal while leaving
supporting detail in Proof Points or the surrounding synthesis prose.

## `scenario-strong/`

Three frameworks (Five Whys, Jobs to Be Done, Fishbone Analysis) assigned to
a well-evidenced input. Demonstrates:

- **Strong convergence** (3 of 3 assigned frameworks) called out explicitly,
  not just "they agree."
- A reframed problem statement that names a root cause in the room's own
  vocabulary, rather than restating the symptom or inventing new terms.
- A real, unresolved **divergence** about *why* the underlying gap persists
  — two different explanations, neither confirmed by the input, correctly
  left open instead of resolved on the user's behalf.
- A **blind spot** that's genuinely cross-document (visible only by reading
  two frameworks' side observations together) and — deliberately — *not*
  promoted into a board card, because it isn't backed by a framework's own
  verified Problem.
- Per-framework confidence carried into the board content rather than
  collapsed into one number, using the `Confidence:` line pattern
  `contracts/synthesis-output.md` defines (the synthesizer's required
  mechanism; `board-output.md`'s optional structured `confidence` field is
  a renderer-side convenience, not something this standard asks for).
- A board with exactly one card — the standard calls for no fixed count, and
  this run genuinely only supports one well-evidenced problem.

## `scenario-uncertain/`

Two frameworks (Five Whys, Jobs to Be Done) assigned to a short, undigested
founder note. Demonstrates:

- **Honest reporting of a genuine disagreement**, not a forced convergence:
  the two frameworks propose different loci (acquisition vs. retention) for
  the same complaint, and the synthesis says so instead of picking a side or
  blending them into one statement.
- **Low confidence carried through, not suppressed** — both candidate
  problems still reach Structured Board Content, each explicitly marked Low
  confidence, because each has a traceable (if thin) proof point. Neither is
  dropped for being uncertain.
- The **"only 2 frameworks assigned" callout** the convergence-grading rule
  requires: with 2 lenses in the whole run, their disagreement is reported
  as a real signal rather than dismissed as "too few to reach consensus."
- A blind spot flagged without being asserted as a finding (the onboarding
  change as a possible shared cause behind both candidates).

## Why these two

Together they cover both halves of the approved standard: what a synthesis
looks like when the evidence genuinely supports confidence, and what it
looks like when honesty requires *not* projecting confidence the evidence
doesn't support. A synthesizer that only ever produced outputs like
`scenario-strong/` would be indistinguishable from one that always finds
what it's looking for; `scenario-uncertain/` is the check against that.

These were verified by running against representative findings from at least
three frameworks, reviewed against the interview answers in
`interview-notes.md`, and checked field-by-field against
`contracts/board-output.md`.
