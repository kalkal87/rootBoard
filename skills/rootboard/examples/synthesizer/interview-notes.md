# Synthesizer Standard — Owner Interview Record

Gathered 2026-08-27, before implementing Ticket 5. This is the recorded
standard `prompts/synthesizer.md` and `contracts/synthesis-output.md` were
written to. If the standard changes later, update this file in the same
change so it stays the source of truth for *why* the prompt says what it
says.

Method: nine topics, each put to the owner as a short set of concrete
options (plus free text) rather than an open-ended question, so the answer
was a real decision rather than a vague preference. The last topic — what a
strong vs. weak synthesis actually looks like — was deferred: the owner
asked to see the two worked examples in `examples/synthesizer/` and react to
those instead of pre-specifying further. Topics 10 and 11 record later
owner-approved refinements to the sticky-note fields.

## 1. What makes a problem statement genuinely useful

**Decision:** It names a root cause or mechanism — not a symptom, and not
just a decision to make. If someone reads the statement and can't tell what
actually causes the problem, it hasn't done its job.

**Applies to:** the "Reframe, don't summarize" rule in
`prompts/synthesizer.md`.

## 2. How much to reframe vs. repeat the source's wording

**Decision:** Reframe the *thinking*, keep the *vocabulary*. The statement
must go beyond what the input or any single framework said outright, but it
should still use the terms, names, and phrases the input's own people used
(e.g. "renewal escalations," "bulk permission editor") rather than inventing
new jargon. A reframe that sounds unrecognizable to the room has overshot.

## 3. What counts as meaningful convergence

**Decision:** A three-tier bar, not a flat "2+ agree":
- **Strong convergence** — 3 or more of the run's assigned frameworks (the
  classifier assigns 2–4) independently land on the same underlying issue.
- **Partial convergence** — exactly 2 frameworks agree. Label it partial,
  not strong. If the run only assigned 2 frameworks in total, say so
  explicitly — 2-of-2 is the most agreement that run could possibly produce,
  and shouldn't read as though it cleared a higher bar than a 2-of-4 case
  would.
- **No convergence** — a single framework, or frameworks that land on
  genuinely different problems.

## 4. How divergence and tension should be presented

**Decision:** Side by side, left unresolved. The synthesizer does not pick a
winner and does not offer a labeled personal lean — it names the tension and
explains why it's real (not a mismatch of wording), then leaves it for the
user. Confirms the existing draft's rule; no change in direction.

## 5. How blind spots should be identified

**Decision:** Cross-document comparison only — something visible because the
synthesizer can see all the findings documents at once, or because a
framework's own "Known blind spot" flags exactly what it would miss. No
proactive checklist of external risk categories (people/incentives/process/
etc.) gets imported wholesale; a blind spot must be traceable to what's
actually in front of the synthesizer for this run, same as a problem
statement needs a traceable proof point.

## 6. How many problems should normally reach the board

**Decision:** No fixed number, and no default target to hit. A run that
genuinely supports one well-evidenced problem should produce one card, not
padding to look thorough. A run with several genuinely distinct problems
should produce several. Card count is a byproduct of what the findings
actually support, never a quality signal on its own.

## 7. How uncertainty and weak evidence should be communicated

**Decision:** Confidence must be carried forward, never suppressed for being
low. A low-confidence problem still reaches the board if it has a traceable
proof point — the only valid reason to drop a problem is a missing proof
point, never low confidence by itself. When contributing frameworks disagree
about their own confidence in the same underlying problem, report that
disagreement rather than collapsing it into one number — the disagreement is
itself informative.

**Open implementation question this created:** `contracts/board-output.md`'s
Card object has no dedicated confidence field. Resolved by folding a
`Confidence: ...` line into `convergence_note` and flagging the schema gap
in the Coverage Note, so a future board-output.md revision can consider
adding a first-class field instead. See `contracts/synthesis-output.md`.

## 8. What belongs in the written synthesis vs. the sticky-note board

**Decision:** The written synthesis carries the full reasoning — why a
convergence is meaningful, why a divergence is left open, why a blind spot
is credible, what's uncertain and why. The Structured Board Content section
is a mechanical, non-reasoning re-expression of the same underlying facts,
shaped for a later step to translate into `contracts/board-output.md`
without guesswork. Nothing may appear in Structured Board Content that isn't
already established in the prose sections above it.

## 9. What a strong vs. weak synthesis looks like

**Decision:** Deferred to the worked examples. See
`examples/synthesizer/scenario-strong/synthesis.md` (three frameworks
converge on one well-evidenced, root-cause-level problem; one open tension
about *why* the underlying gap persists is named and left unresolved; a
plausible blind spot is flagged but deliberately not promoted to a board
card because it isn't independently verified) and
`examples/synthesizer/scenario-uncertain/synthesis.md` (two frameworks
genuinely disagree about which side of the funnel the real problem is on,
both on thin, low-confidence evidence — the synthesis says so plainly
instead of manufacturing a false convergence or picking a side).

Owner reaction to these examples is the approval gate for this ticket —
see `examples/synthesizer/README.md`.

## 10. Sticky-note Problem Statement length and shape (refinement, 2026-08-30)

Raised after topic 1 shipped: synthesized Problem Statements were correctly
naming root causes, but running long enough that the sticky note at the top
of a generated board card read as a dense paragraph rather than a scannable
headline.

**Decision:** Topic 1 is unchanged — a Problem Statement still names a root
cause or mechanism, not a symptom. What's new is a shape requirement for
the sticky-note version of that statement:

- It must work as a sticky-note headline, not a miniature analysis.
- It should ideally contain 15–22 words, and never more than 30.
- It names the affected actor or system, the outcome that's blocked or
  degraded, and the root mechanism — in substance, not as a fixed
  fill-in-the-blank sentence. The structure is semantic; natural phrasing
  that reads well is preferable to repeating the same connectors (e.g.
  "struggles to... because...") on every card.
- Impact, evidence, and qualifications (confidence, convergence,
  divergence) stay in their existing dedicated card fields — `Impact`,
  `Proof Points`, and `Convergence Note` — rather than being folded into
  the statement to make it read as a complete thought on its own.
- Genuine uncertainty is carried with a single calibrated qualifier ("may,"
  "appears to") in the statement itself; the fuller explanation of *why*
  it's uncertain stays in the confidence/convergence material, not
  appended to the sentence.

**Applies to:** the sticky-note Problem Statement guidance in the
root-cause reframing rule of `prompts/synthesizer.md`, and the "Problem
Statement shape" subsection of `contracts/synthesis-output.md`. This
refines topic 1's standard rather than replacing it — the root-cause
requirement stands; only the sticky-note surface form is new.

## 11. Sticky-note Impact length and analytical shape (refinement, 2026-09-01)

Raised because Impact remained useful but often grew into a dense collection
of consequences and proof points, weakening the card's punchiness.

After a local end-to-end test, the owner confirmed that shorter prose alone
was insufficient: an Impact that merely compressed evidence or stakeholder
behavior still failed to answer the consultant's "so what?" question.

**Decision:** Keep the accepted balanced length while giving Impact a clear
analytical purpose:

- Impact is one sentence targeting 12–20 words and never more than 24.
- It answers: **What business or operating outcome gets worse if this problem
  continues?** The sentence leads with the primary supported consequence —
  lost time or capacity, delayed value, weaker performance or conversion,
  revenue or service risk, or poorer decision quality — and quantifies it
  when the input allows.
- When several frameworks contribute different symptoms, the synthesizer
  selects the most decision-relevant consequence rather than concatenating
  every framework's wording.
- It does not restate the cause, summarize stakeholder behavior, or list
  Proof Points. The Problem Statement owns the mechanism; Impact owns the
  consequence; evidence and confidence remain in their dedicated fields.
- If the input supports only an observed symptom and not a downstream
  consequence, the field states the symptom plainly rather than inventing
  consultant-sounding certainty the evidence cannot carry.

**Applies to:** Impact generation in `prompts/problem-solving-agent.md` and
`contracts/agent-findings.md`, plus final Impact compression in
`prompts/synthesizer.md` and `contracts/synthesis-output.md`.
