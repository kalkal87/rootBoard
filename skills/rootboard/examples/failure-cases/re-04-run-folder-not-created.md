# RE-04 — The run folder could not be created

No probe in `error-probes.md`, and not one of Ticket 7's ten required cases —
included because it is a real stage-2 failure with guidance of its own, and
the only case where the user's material is at risk.

Severity: `halt`.

## Trigger

Point the run at a location that can't be written to:

```
$ echo "test transcript" | python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/new_run.py" --runs-dir "/System/nope/runs"
RE-04: The run folder could not be created at /System/nope/runs/2026-08-27-2341-run
(Operation not permitted). Nothing was analysed and nothing was saved. Check
that the location exists and is writable, or ask for the run to be saved
somewhere else.
$ echo $?
5
```

In practice this fires on a full disk, a `~/Documents` that lives on an
unmounted network volume, or a project path handed in by the user that
doesn't exist. A sandbox denial can occur before the script starts. In that
case, request access only to `~/Documents/rootBoard/runs/` and retry; use the
response below only after the approved retry fails or the user declines every
offered location.

## What the user sees

> I couldn't create the folder for this run at
> `~/Documents/rootBoard/runs/`. Nothing was analyzed or saved, and your
> transcript is still here in the chat, so it isn't lost.
>
> If you want, I can instead use
> `<project-root>/rootboard-runs/`. That puts the transcript and analysis
> inside this project, where they may appear in `git status`, so I will only
> use it if you explicitly approve that location. You can also name another
> folder.

## Why this passes

**What happened** — names the exact location that was tried, so a user whose
Documents folder is on a disconnected drive can recognize the situation
immediately.

**Was work saved** — this is the interesting one. Nothing was written to
disk, but the transcript the user pasted is not gone; it's in the
conversation. Saying so is the difference between a user who waits for a fix
and a user who goes hunting for the file they think they've lost.

**What to do next** — offers an alternative location and asks for one, rather
than picking somewhere and proceeding.

## The thing most likely to go wrong here

Starting the analysis anyway and intending to save it later. It's tempting —
the transcript is right there and the lenses would run fine — but the one
ordering guarantee this workflow makes is that the input reaches disk before
any analysis begins. A run that analyzes first and discovers it can't write
anything after twenty minutes of work has lost all of it, and has spent the
user's time to arrive at the same message.

The second risk is silently falling back to project-local storage. That
location exists, but it's opt-in for a reason: run folders hold transcripts
verbatim, and dropping one into a git repository the user didn't ask to use is
exactly the outcome the default is designed to prevent.
