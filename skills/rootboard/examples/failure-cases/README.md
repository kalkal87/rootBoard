# Failure Cases

Worked examples of what the user is told when a run doesn't go cleanly. One
file per failure point in `contracts/runtime-errors.md`.

These exist so the standard in `error-handling/voice.md` is demonstrated
rather than only described. `error-handling/responses.md` gives the model
message for each case; these show a filled-in representative instance, with
the trigger that produces it and a note on what makes it right.

## The files

| File | Case | Probe |
|---|---|---|
| `re-01-no-input.md` | Nothing was provided to analyze | P-01 |
| `re-02-file-not-found.md` | The path doesn't exist | P-02 |
| `re-03-file-unreadable.md` | A folder, a permissions problem, a PDF | P-03 |
| `re-04-run-folder-not-created.md` | Nowhere to save the run | — |
| `re-05-thin-input.md` | The transcript is too thin to carry much | P-04 |
| `re-06-poor-framework-fit.md` | One lens found almost nothing | P-05 |
| `re-07-lens-did-not-report.md` | A lens didn't finish | P-07 |
| `re-08-findings-wrong-shape.md` | A lens's notes couldn't be compared | P-06 |
| `re-09-lenses-disagree.md` | Two lenses reached different conclusions | P-08 |
| `re-10-board-data-invalid.md` | The board's data came out wrong | P-09 |
| `re-11-whiteboard-not-built.md` | The board file couldn't be assembled | — |
| `re-12-old-runs.md` | Finding, reopening, or deleting past runs | P-10 |

## How each file is laid out

**Trigger** — the input or artifact shape that produces this case. Evaluation
fixtures live outside the distributed skill, so each example is described
self-containedly here.

**What the user sees** — the message, filled in with real paths and names.
This is the part being demonstrated.

**Why this passes** — the three questions checked off, and the specific
failure signals that this wording avoids.

## Reading these as a set

Two things become obvious across the twelve, and both are the point:

**Most of them aren't errors.** Seven describe a run that worked and found
less than hoped, or a user asking a question. Written as failures they would
mislead — the loudest example is `re-09`, where the skill has done the most
useful thing it can do and an error-shaped message would say otherwise.

**None of them lose work.** After the run folder exists, every case names a
real path the user can open. The three that save nothing are the three where
the input never arrived, and each of those says so plainly instead of leaving
the question open.

## A note on what the checker catches

`orchestration/scripts/check_run.py` catches a *missing* findings file
(`re-07`). It does not catch a file that exists but is unusable (`re-08`) —
confirmed by running the malformed fixture through it, where all three lenses
report `ok`. Judging whether a document can be compared is a reading task, and
`contracts/runtime-errors.md` assigns it to the synthesizer rather than to a
script. Worth knowing before trusting a green check to mean the analysis is
sound.
