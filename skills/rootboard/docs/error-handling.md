# When a run doesn't go cleanly

What rootBoard does when something goes wrong, written for the person
using it. If you've just been told a run was incomplete and you want to know
what that means for your work, start here.

The short version: **your material is saved, and you'll be told where.** The
input is written to disk before any analysis begins, and every step's output
is saved as it finishes, so a run that stops partway still leaves you with
everything it got through.

## Where your work is

Every run gets a folder, by default:

```
~/Documents/rootBoard/runs/<date>-<time>-<subject>/
```

The path is reported to you when the run *starts*, not when it finishes —
deliberately, so that if something goes wrong later you already know where to
look. A complete run's folder holds:

| File | What it is |
| --- | --- |
| `input.md` | Your transcript, exactly as you gave it. |
| `run-status.md` | A step-by-step record of how the run went. |
| `classification.md` | Which lenses were chosen, and why. |
| `findings-<lens>.md` | What each lens found, one file per lens. |
| `synthesis.md` | The full analysis in prose — the most readable file here. |
| `board-data.json` | The whiteboard's underlying data. |
| `whiteboard.html` | The whiteboard. Open it in a browser. |

A folder missing some of these is a run that stopped partway. `run-status.md`
says which step it stopped at.

**`synthesis.md` is worth knowing about.** It's the whole analysis written as
prose, and it doesn't depend on the whiteboard at all. If the board couldn't
be built for any reason, that file still has everything.

## The kinds of thing that go wrong

### Nothing arrived to analyze

The transcript wasn't provided, or the file couldn't be found or opened. No
folder is created and nothing is saved — there's nothing to recover, and the
fix is to paste the material in or correct the path.

If you point at a PDF, a Word document or a recording, you'll be asked for
text instead. This works from plain text and markdown; it can't open the
others, and it can't transcribe audio.

### The transcript was thin

The run still happens and you still get a whiteboard. You'll be told that the
material was short and that the result is correspondingly limited, along with
what would make a re-run more useful — usually the rest of the conversation.

This isn't a complaint about your input. A short transcript honestly analyzed
is more useful than a short transcript padded out to look thorough.

### One lens found very little

Each lens looks for a particular kind of problem, and sometimes an input just
doesn't contain that kind. A cause-tracing lens has little to do with a
forward-looking planning discussion, for instance.

You'll be told which lens found little and why. The lens's own file is still
in the folder, and it will say the same thing in its own words. This is
information about your input, not a fault.

### One lens didn't finish

The run continues with the lenses that did report, and you'll be told which
one is missing. This matters for how you read the board: when two lenses
independently land on the same problem that's meaningful, and it's *more*
meaningful when three do. A board built from two lenses shouldn't be read as
though three agreed.

Everything the other lenses produced is saved. You can ask for just the
missing lens to be re-run — it won't disturb what's already there.

### The lenses disagreed

Not a failure. When two lenses reach genuinely different conclusions from the
same evidence, both go on the board and the tension is written up under
"Divergence" in `synthesis.md`.

Nothing picks a winner for you, and nothing averages the two into a statement
neither lens actually supports. Disagreement between two careful readings of
your own material is usually the most useful thing a run produces — it's
pointing at a decision only you can make.

### The whiteboard couldn't be built

Two different situations, and you'll be told which:

- **The board's data came out wrong.** The analysis is fine; converting it
  into the board's data went wrong. Rather than hand you a board that opens
  and looks plausible but is quietly incorrect, the run stops. Everything up
  to that point is saved, and `synthesis.md` has the full analysis. Nothing
  needs re-analyzing to try again.
- **The file couldn't be assembled.** Usually an installation problem rather
  than anything to do with your material. Re-installing or updating the skill
  and rebuilding from the saved data is the fix — again, no re-analysis.

You will never be handed a whiteboard that wasn't actually created, or told a
run finished when it didn't.

## Finding and cleaning up old runs

Folders are named by date and subject — `2026-08-21-1045-q3-retro` — so
`~/Documents/rootBoard/runs/` is browsable directly in Finder or
Explorer, sorted chronologically. You can also just describe the run you're
after ("the retro from last week") and it'll be located for you.

Nothing is ever deleted automatically, and runs accumulate one folder each.
Delete them like any other folder, or ask — you'll be shown exactly what would
be removed and asked to confirm before anything goes.

**Before you delete, remember what's in there.** `input.md` is your original
material verbatim: customer names, salary discussions, internal strategy,
whatever was in the transcript. It's plain text on your disk, not encrypted,
though it never leaves your machine and nothing about a run is sent anywhere.
That's worth a thought both when you clean up and when you share a run folder
with someone.

## If you're reading this because a message confused you

That's a defect worth reporting, not a misunderstanding on your part. Every
message this skill produces about a failure is supposed to tell you what
happened, whether your work was saved and where, and what to do next — in
words that don't require knowing how any of this is built. If one didn't, the
standard it fell short of is written down in `error-handling/voice.md`.
