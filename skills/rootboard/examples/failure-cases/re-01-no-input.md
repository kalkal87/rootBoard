# RE-01 — Nothing was provided to analyze

Probe P-01. Severity: `report` — this is a request for input, not an error.

## Trigger

Invoke the skill with no transcript, no file path, and no context — the bare
request and nothing else:

> Help me figure out the real problem here.

Or hand `new_run.py` an empty input:

```
$ printf '' | python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py"
RE-01: No input was provided. This skill needs a meeting transcript or a
freeform context dump to work from -- paste one in, or give a path to a text
or markdown file.
$ echo $?
2
```

That output is the internal signal. The user reads the message below instead.

## What the user sees

> I need the transcript or context dump before I can start — that's the
> material this works from, and guessing from a one-line description would
> just hand you back your own assumptions.
>
> Paste it straight into the chat, or give me a path to a text or markdown
> file. Nothing's been created yet, so there's nothing to clean up.

## Why this passes

**What happened** — the first sentence, and it names the reason rather than
just the fact. "Guessing would hand you back your own assumptions" is the
actual argument for why the skill won't proceed, and it's a reason the user
can agree with.

**Was work saved** — "nothing's been created yet, so there's nothing to clean
up." An empty answer, given rather than skipped. Without it a user may wonder
whether a stray folder is now sitting in their Documents.

**What to do next** — both input routes, in one line.

**Avoids the failure signals:** it doesn't guess a problem from the one-line
request, no run folder is created, and no empty board is produced.

## The thing most likely to go wrong here

Writing it as an error. This is the most common way a user meets the skill —
they invoke it before pasting — so it is closer to a greeting than a fault
report. No apology, no "unable to proceed", nothing that suggests they did
something wrong by asking.

The second risk is being helpful in the wrong direction: offering to analyze
the one-line request itself, or to work from what's already in the
conversation. The input is supposed to carry the substance, and a run built
from a summary produces a board of the user's own assumptions with three
lenses' worth of apparent authority behind it.
