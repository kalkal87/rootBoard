# Voice

How a rootBoard message about a failure is written. `responses.md` has
the twelve messages themselves; this file is the standard they are all written
to, so they sound like one product rather than twelve separate apologies.

The reader is a non-technical person — a product manager, a consultant, a
founder — who pasted in a transcript and is waiting for a whiteboard. They
did not install a pipeline. They do not know what a subagent is, and nothing
that happens inside this skill is their fault.

## The three questions

Every message answers all three, in this order:

1. **What happened** — in the user's terms.
2. **Was any useful work saved** — and if so, the exact path.
3. **What to do next** — something they can actually do.

Answer them as prose, not as labelled sections. A message with the headings
"What happened / What was saved / What to do next" stamped on it reads like a
form, and a two-line problem does not need three headings. The order is what
matters: a user who reads only the first sentence should know what happened,
and a user who reads only the last should know what to do.

When one of the three has an empty answer, say the empty answer. "Nothing was
saved, and no folder was created" is an answer. Silently dropping the question
is not — a user who isn't told about their work assumes the worst.

## Never use these words

The rubric scores a message down to a 1 for internal vocabulary the user has
no way to act on, however accurate it is. Translate:

| Never write | Write instead |
|---|---|
| agent, subagent, spawn | the name of the lens — "the Five Whys reading" |
| the classifier | "choosing which lenses to use" |
| the synthesizer | "the step that compares the readings" |
| findings file, findings document | "what the Five Whys reading found", plus the filename |
| contract, schema, malformed, invalid | "isn't in the shape the whiteboard needs" |
| board data, render, build, artifact | "the whiteboard's data file", "make the whiteboard", "the whiteboard" |
| stage, pipeline, workflow, orchestration | "step", or just describe what was happening |
| RE-07, exit code 4, stderr | nothing — these are internal handles, never shown |
| parse, validate, normalize | "read", "check" |
| degraded run | "a run with one lens missing" |

Framework names are always safe, and always better than a category: "the Lean
Wastes reading" beats "one of the lenses". Filenames are safe too — the user
will be looking at these files in Finder, so `findings-five-whys.md` is more
useful to them than "the findings file".

## Be specific

Generic reassurance scores a 2 where the specific version scores a 3, and the
difference is almost always a path or a number that was already in hand:

> Some of your work may have been saved.

> Your transcript and all three readings are saved in
> `~/Documents/rootBoard/runs/2026-08-27-2340-northwind-board-pack/`.

Name the file, the count, the lens, the exact path the skill tried. If a
message could be copied unchanged into a different run, it is too generic.

## Don't alarm, don't apologize, don't blame

- **No alarm.** No "ERROR", no "FAILED", no exclamation marks, no warning
  symbols. Most of what goes wrong here is the analysis honestly finding less
  than hoped, and nothing has been destroyed in any of the twelve cases.
- **No apology spiral.** One plain sentence about what happened. Do not
  apologize repeatedly, explain at length how it went wrong, or promise it
  won't happen again.
- **No blame.** Never imply the user gave bad input, chose wrong, or should
  have done something differently. A short transcript is a short transcript,
  not a mistake. "The transcript is quite short, so" — not "you'll need to
  provide more".
- **No hedging about what exists.** Files are on disk or they are not. Never
  write "should be saved at" or "may have produced" — check, then state it.

## Length

Two to five sentences for most cases. A message long enough to skim past is a
message the user will skim past, and the next step is usually the last line.

The exceptions are the ones where the substance genuinely is the message:
RE-05, RE-06 and RE-09 are reports about a finished run, not failures, and
belong in the run's normal closing summary rather than in a message of their
own.

## Script output is not the message

`orchestration/scripts/` prints diagnostics that begin `RE-02:` and name exit
codes. That output is a signal *to whoever is running the skill*, telling them
which case fired. It is not what the user reads. Take the case it identifies,
then write the user's message from `responses.md`.

Never paste a script's output, a file-system error, or a stack trace into the
conversation as the explanation.

## The one rule that outranks the rest

**Never report a whiteboard that does not exist**, and never let a partial run
read as a complete one. A warm, plain-language, well-structured message that
implies five lenses agreed when only two reported is worse than no message —
it is the only failure the rubric scores 0 outright. If you are unsure whether
something finished, check the run folder before you describe it.
