# Runtime Errors Contract

Every way a run can fail, where it fails, what state the run is in when it
does, and what has to be preserved. Twelve failure points, `RE-01` to
`RE-12`.

This file is the interface between Ticket 6 and Ticket 7. It owns *what can
go wrong, where, and what survives it*. It does **not** own the words the
user reads — Ticket 7 writes those, in `error-handling/` and
`docs/error-handling.md`, one response per failure point below.

Ownership: Ticket 6 (definition), Ticket 7 (user-facing responses).

## How to read an entry

| Field | Meaning |
| --- | --- |
| **Stage** | The stage in `orchestration/run-workflow.md` where it surfaces. |
| **Severity** | `halt`, `degrade`, or `report` — see below. |
| **Detected by** | What notices. A script exit code where one exists. |
| **Run state** | What is on disk at the moment of detection. This is what the user's "was any work saved?" answer must be built from. |
| **Must be preserved** | What the handler may not discard or overwrite. |
| **Must not** | The specific wrong behavior this failure point invites. |

### Severity

- **`halt`** — the run cannot continue. There is no artifact and there must
  be no claim of one.
- **`degrade`** — the run continues and still produces a whiteboard, but the
  result is weaker than a clean run and **the weakening must be disclosed in
  the final message**, not only recorded in a file. A degraded run that reads
  as a clean one is the failure this contract exists to prevent.
- **`report`** — not a malfunction. A legitimate result, or a user request,
  that has to be communicated well. An error-shaped message here is itself a
  defect.

Seven of these twelve are `report` or `degrade`, and two more halt only the
artifact rather than the run. Just three stop a run outright, and all three
are intake problems. That ratio is deliberate: most of what goes wrong in a
run is the analysis honestly finding less than hoped, and dressing that up as
a system error tells the user the wrong thing.

### The three questions

Per Ticket 7, every user-facing response answers all three:

1. What happened — in the user's terms, not the system's.
2. Was any useful work saved — and if so, exactly where.
3. What should the user do next — something they can act on.

For a `halt` before stage 2, the honest answer to (2) is "nothing yet, and no
folder was created". Say that rather than omitting the question.

---

## RE-01 — No input was provided

- **Stage:** 1 (intake) · **Severity:** `report`
- **Detected by:** the coordinator, before anything runs; or
  `new_run.py` exit 2 when the input is empty or whitespace.
- **Run state:** nothing. No run folder exists.
- **Must be preserved:** n/a.
- **Must not:** create a run folder; guess a problem from the one-line
  request; produce an empty board. This is a request for input, not an
  error, and should not read like one.

The response says what the skill takes — a meeting transcript or a freeform
context dump, pasted in or as a path to a text or markdown file — and stops
there.

*Ticket 7 case: "No input was provided." · Probe: P-01*

---

## RE-02 — The input file does not exist

- **Stage:** 1 · **Severity:** `halt`
- **Detected by:** `new_run.py` exit 3.
- **Run state:** nothing. No run folder exists.
- **Must be preserved:** n/a.
- **Must not:** surface a raw filesystem error; continue with empty input;
  leave a run folder behind; omit the path from the message.

The response repeats the exact path back and offers both ways forward:
correct the path, or paste the content directly.

*Ticket 7 case: "The input file cannot be found or opened." · Probe: P-02*

---

## RE-03 — The input file exists but cannot be read

- **Stage:** 1 · **Severity:** `halt`
- **Detected by:** `new_run.py` exit 4 — the path is a directory, the open
  failed on permissions, or the bytes are not decodable text.
- **Run state:** nothing. No run folder exists.
- **Must be preserved:** n/a.
- **Must not:** report this as "not found"; list a directory's contents as
  an input; describe the cause in internal vocabulary.

Kept separate from RE-02 because the user's next action differs: a wrong
path is retyped, a permissions problem is fixed in the file system, and a
PDF or audio file has to have its text exported first. The response names
which of those it is.

*Ticket 7 case: "The input file cannot be found or opened." · Probe: P-03*

---

## RE-04 — The run folder could not be created

- **Stage:** 2 (run setup) · **Severity:** `halt`
- **Detected by:** the host sandbox blocking the external write before
  `new_run.py` starts, or `new_run.py` exit 5 after the operation is permitted.
- **Run state:** nothing saved. The input is still in the conversation.
- **Must be preserved:** the input the user pasted — do not discard the
  conversation's copy of it while offering an alternative location.
- **Must not:** treat the first sandbox denial as a terminal filesystem
  failure; silently switch to project-local storage; or proceed to analysis
  with nowhere to save results. The one ordering guarantee this workflow makes
  is that the input is on disk before analysis begins; if that fails, the run
  does not start.

For a sandbox denial, request access only to the exact default runs directory
and retry the same operation. If the user declines, explain the privacy and
repository-hygiene tradeoff and offer project-local storage; use it only after
explicit consent. Report RE-04 after an approved operation still fails or the
user declines every offered location. The response says nothing was analyzed
or saved and names the location that was attempted.

*Ticket 7 case: not in Ticket 7's list, but it needs a response like the
rest. · No probe.*

---

## RE-05 — The input is too short or too unclear

- **Stage:** 3 (classification), carried through to stage 8 ·
  **Severity:** `degrade`
- **Detected by:** the classifier, per its own failure behavior in
  `prompts/classifier.md`.
- **Run state:** run folder created, `input.md` saved. The run continues.
- **Must be preserved:** everything. This is not an abort — the classifier
  makes a best-effort selection favoring general-purpose lenses, the run
  completes, and the user gets a real whiteboard.
- **Must not:** refuse to run; run as though the input were rich; imply the
  user did something wrong.

The thinness is disclosed twice — once in the classifier's Coverage Note and
the synthesizer's, once in the final message — and the response says what
would make a re-run more useful (a longer transcript, the missing half of
the conversation, what happened next).

*Ticket 7 case: "The input is too short or too unclear." · Probe: P-04*

---

## RE-06 — A framework is a poor fit

- **Stage:** 4 (framework agents) · **Severity:** `report`
- **Detected by:** the agent itself, in its findings Coverage Note, with few
  or no problems listed.
- **Run state:** a complete, valid findings file that happens to be nearly
  empty. Other lenses are unaffected.
- **Must be preserved:** the findings file. An empty Problems Identified
  section is a legitimate, informative result, not a malformed document.
- **Must not:** manufacture a causal chain to fill the section; let the weak
  fit go unmentioned; present the run as though every lens contributed
  equally.

The synthesizer notices and says so in its own Coverage Note. The user is
told which lens found little and why — not left to infer it from a thin
board.

*Ticket 7 case: "A framework is a poor fit." · Probe: P-05*

---

## RE-07 — A framework agent failed or returned nothing

- **Stage:** 4 · **Severity:** `degrade`
- **Detected by:** no `findings-<slug>.md` for an assigned lens after its
  agent finished; confirmed at stage 8 by `check_run.py` exit 1.
- **Run state:** run folder, `input.md`, `classification.md`, and the
  findings files of the lenses that did complete.
- **Must be preserved:** every findings file that did land. Losing three
  good lenses because a fourth failed is the worst available outcome.
- **Must not:** synthesize from two lenses while describing a three-lens
  run; let the board imply convergence across a lens that never reported;
  overwrite the run folder by restarting from scratch.

`run-status.md` records the stage as `failed` with the lens named. The
synthesizer is told how many lenses it actually has, because convergence is
graded against the number assigned. The response names the missing lens,
says the others completed and where they are, notes that convergence claims
are weaker with a lens missing, and offers to re-run just that lens.

*Ticket 7 case: "A problem-solving agent fails or returns incomplete
findings." · Probe: P-07*

---

## RE-08 — A findings file violates the findings contract

- **Stage:** 4, detected at stage 5 · **Severity:** `degrade`
- **Detected by:** the synthesizer, reading a document that does not match
  `contracts/agent-findings.md` — missing framework attribution, sections
  merged or absent, a problem with no proof points.
- **Run state:** as RE-07, plus one unusable document on disk.
- **Must be preserved:** the malformed file itself (do not delete it — the
  user may want to see what came back) and every sound findings file.
- **Must not:** partly consume it; carry a problem with no proof points onto
  the board; crash and lose the sound files.

Handled as RE-07 from the synthesizer onward: that lens is treated as not
having reported. The response additionally says what was unusable about the
document, so the user can tell a broken agent from an unlucky one.

*Ticket 7 case: "A finding file does not follow the expected format." ·
Probe: P-06*

---

## RE-09 — The synthesizer cannot confidently combine the findings

- **Stage:** 5 (synthesis) · **Severity:** `report`
- **Detected by:** the synthesizer, per its own failure behavior.
- **Run state:** everything through the findings files; `synthesis.md` is
  being written.
- **Must be preserved:** both sides of the disagreement, as separate cards.
- **Must not:** pick a winner without saying so; average two positions into
  a statement neither findings file supports; emit an error message where a
  divergence report belongs.

This is the product working, not failing. An input containing a real,
unresolved tension should produce a synthesis that names the tension and
leaves it with the user. The response frames it that way: the run found
something the user has to settle, and here is each side with its evidence.

*Ticket 7 case: "The synthesizer cannot confidently combine the findings." ·
Probe: P-08*

---

## RE-10 — The board data is invalid

- **Stage:** 6 (translation), gated before stage 7 · **Severity:** `halt`
  for the artifact, `degrade` for the run
- **Detected by:** `translate_board_data.py` exit 1 (could not parse
  `synthesis.md`'s `Structured Board Content`), exit 2 (`synthesis.md`
  missing or unreadable), exit 3 (the parsed result still fails the board
  contract), or exit 4 (`board-data.json` could not be written, e.g. a full
  disk — written via a temp file and renamed into place, so an existing
  `board-data.json` from a previous run survives this one intact). Also
  `validate_board_data.py` exit 1 (contract violations) or exit 2 (missing
  or unparseable file), for board data that reached this stage some other
  way (a hand translation, a fixture). `build_whiteboard.py` re-runs the
  same contract check and writes nothing if it fails.
- **Run state:** input, classification, findings, and `synthesis.md` all
  saved. `board-data.json` either exists but is unusable, or — if
  `translate_board_data.py` refused to parse `synthesis.md` at all — was
  never written, the same as a script that fails before its first write.
  Either way: no whiteboard.
- **Must be preserved:** everything upstream, especially `synthesis.md` —
  the analysis is intact and readable even with no board.
- **Must not:** present a board built from invalid data; drop the bad cards
  and render the rest as though complete; let a browser console error be the
  only signal.

**The renderer will not catch this.** Card normalisation in
`renderer/whiteboard/whiteboard.js` is deliberately tolerant: a missing
`problem_statement` becomes an empty string, a non-numeric `position` falls
back to a staircase by index, a malformed framework entry becomes "Untitled
framework". Nothing throws. Worse than silent, a duplicate `id` renders two
cards that delete as one, because deletion filters by id. That tolerance is
correct for a renderer that must never fail to open a saved artifact, which
is exactly why validation is the workflow's job and this failure point
exists.

The response says the board could not be built from this run's data, names
the specific defect, and points at the findings and synthesis that are still
saved and still worth reading.

*Ticket 7 case: "Board data is invalid." · Probe: P-09*

---

## RE-11 — The whiteboard could not be generated

- **Stage:** 7 (render) · **Severity:** `halt` for the artifact, `degrade`
  for the run
- **Detected by:** `build_whiteboard.py` exit 3 (a renderer or template file
  is unreadable, or the template no longer matches what the assembler
  substitutes) or exit 4 (the artifact could not be written).
- **Run state:** everything through valid `board-data.json`. No whiteboard.
- **Must be preserved:** all of it. This failure is downstream of every
  piece of thinking in the run.
- **Must not:** report a whiteboard that does not exist; leave a
  half-written artifact in place of the missing one.

Distinct from RE-10: there the analysis produced something unusable, here
the analysis is sound and the assembly step broke. The user's next action
differs — RE-10 needs the synthesis revisited, RE-11 needs the install
checked or the step re-run. The response can offer the board data itself as
a fallback, since it holds the full analysis in a portable form.

*Ticket 7 case: "The whiteboard cannot be generated." · No probe.*

---

## RE-12 — Finding, reopening, or cleaning up an old run

- **Stage:** outside any run · **Severity:** `report`
- **Detected by:** the user asking — "the retro one from last week", "how do
  I delete these".
- **Run state:** n/a. Other runs exist on disk.
- **Must be preserved:** every run folder, until the user has confirmed
  which one is being removed.
- **Must not:** delete without confirming exactly what would be removed;
  fail to locate a run that exists; describe the folder structure in
  internal terms.

Not a failure at all, but it needs the same care as one, because it is the
one case where the response can destroy the user's work. The runs directory
is named, its `<YYYY-MM-DD-HHmm>-<slug>` convention explained in one line,
and the matching run identified by folder name. Deletion is confirmed first,
with plain-language acknowledgement that run folders can hold sensitive
material verbatim.

*Ticket 7 case: "The user wants to find, reopen, or clean up an old run." ·
Probe: P-10*

---

## Coverage

| # | Failure point | Stage | Severity | Ticket 7 case | Probe |
| --- | --- | --- | --- | --- | --- |
| RE-01 | No input provided | 1 | report | 1 | P-01 |
| RE-02 | Input file not found | 1 | halt | 2 | P-02 |
| RE-03 | Input file unreadable | 1 | halt | 2 | P-03 |
| RE-04 | Run folder not created | 2 | halt | — | — |
| RE-05 | Input too thin or unclear | 3 | degrade | 3 | P-04 |
| RE-06 | Framework a poor fit | 4 | report | 4 | P-05 |
| RE-07 | Agent failed or returned nothing | 4 | degrade | 5 | P-07 |
| RE-08 | Findings file malformed | 4→5 | degrade | 6 | P-06 |
| RE-09 | Findings cannot be combined | 5 | report | 7 | P-08 |
| RE-10 | Board data invalid | 6 | halt/degrade | 8 | P-09 |
| RE-11 | Whiteboard not generated | 7 | halt/degrade | 9 | — |
| RE-12 | Finding or cleaning up an old run | — | report | 10 | P-10 |

Ticket 7's ten required cases are covered; RE-02 and RE-03 split its second
case, because the user's next action differs between them. RE-04 has no
Ticket 7 case and no probe, and is included because it is a real stage-2
failure with distinct guidance — a run cannot start with nowhere to save.

## The rule underneath all twelve

**A failed stage must never appear to have succeeded.** Three mechanisms
enforce it, and a response for any failure above should be able to point at
what they recorded:

- `run-status.md`, written at run setup with every stage `pending` and
  updated as each finishes. A row still reading `pending` is a stage that
  never ran.
- `validate_board_data.py`, which gates the render on a contract the
  renderer is too tolerant to enforce.
- `check_run.py`, which cross-checks the assigned lenses, the findings files
  on disk, and the stage results against each other before the run is
  reported.

The final message names files confirmed on disk. Not files the workflow was
supposed to produce.
