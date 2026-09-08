# RE-07 — A lens didn't finish

Probe P-07. Severity: `degrade` — the run continues, and every claim it makes
shrinks to match.

## Trigger

Delete one findings file from a run before synthesis, or interrupt one lens
mid-run. Run the completeness check against the result:

```
$ python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/check_run.py" "<absolute-run-path>"
...
Lenses assigned by the classifier: 3
  ok       findings-jobs-to-be-done.md
  MISSING  findings-lean-wastes.md
  ok       findings-five-whys.md

This run is INCOMPLETE. Do not describe it to the user as a finished analysis:
  - the lean-wastes lens was assigned but never produced a findings file
$ echo $?
1
```

**Worth seeing what this catches.** In the probe above, `run-status.md` still
said stage 4 was `ok` with "All 3 lenses reported" — the record was written
before the file went missing and was simply wrong. The check compares the
lenses `classification.md` assigned against the files actually on disk, so it
caught the discrepancy regardless of what the status file claimed. That is the
whole reason the check exists: a stage that failed after recording success is
exactly the case a status file can't detect on its own.

## What the user sees

> One of the three lenses didn't finish: the Lean Wastes reading stopped
> partway and didn't produce anything. The other two completed normally, and
> everything else is saved in
> `~/Documents/rootBoard/runs/2026-08-28-0915-supply-delays/` — your
> transcript, the Jobs to Be Done and Five Whys readings, the synthesis, and
> the whiteboard.
>
> So treat this as a two-lens board rather than a three-lens one. Where those
> two agreed, that's real, but it's weaker evidence than agreement across
> three would have been. I can re-run just the Lean Wastes reading against the
> same transcript if you want the third view — it won't disturb what's already
> there.

## Why this passes

**What happened** — names the specific lens. "One of the lenses failed" would
be true and much less useful; the user may well have views about whether Lean
Wastes was the one worth having here.

**Was work saved** — the exact folder, and an inventory of what's in it.

**What to do next** — the offer to re-run the single missing lens, with the
reassurance that it won't disturb existing work. This is the thing the user
actually wants and it costs them nothing.

**The paragraph that makes this a 3 rather than a 2** is the second one.
Telling the user what the missing lens means for *how to read the board* —
that two-lens agreement is real but weaker than three — is the difference
between an accurate report and a useful one. The board looks identical either
way; only this message tells them how much weight to put on it.

**Avoids the failure signals:** it doesn't synthesize from two lenses while
describing a three-lens run, and the board never implies convergence across a
lens that never reported.

## The thing most likely to go wrong here

Quiet arithmetic. A three-lens run that becomes a two-lens run and is then
described in language that still fits three — "the lenses agreed", "all the
readings pointed at" — is the failure this case exists to prevent, and it
happens without anyone deciding to mislead. The count has to change everywhere
downstream, including in the synthesizer's brief, because convergence is
graded against the number of lenses assigned.

The second risk is throwing away good work. Two complete readings and a
transcript are worth having; restarting the run from scratch to get a clean
three discards them and spends the user's time again.
