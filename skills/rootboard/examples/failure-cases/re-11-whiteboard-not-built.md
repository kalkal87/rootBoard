# RE-11 — The whiteboard couldn't be made

No probe in `error-probes.md`. Severity: `halt` for the artifact, `degrade`
for the run.

## Trigger

Point the build step at a renderer file that isn't there — which is what a
broken or partial installation looks like from the inside:

```
$ python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/build_whiteboard.py" "<absolute-run-path>" --js "<ROOTBOARD_SKILL_ROOT>/renderer/whiteboard/does-not-exist.js"
RE-11: The whiteboard could not be built because the whiteboard renderer could
not be read (No such file or directory at renderer/whiteboard/does-not-exist.js).
The run's findings, synthesis and board data are still saved.
$ echo $?
3
```

The other routes into this case: the board template no longer contains the
markers the build step substitutes (a partial update, or a hand-edited
template), or the run folder became unwritable between the analysis and the
build.

## What the user sees

> The analysis all completed, but I couldn't assemble the whiteboard file
> itself — part of the whiteboard's own code is missing from the installed
> skill, so there was nothing to build the page from.
>
> The whole run is saved in
> `~/Documents/rootBoard/runs/2026-08-28-1610-pricing/`. `synthesis.md`
> is the full analysis and reads on its own, and `board-data.json` holds all
> five cards, so nothing has to be re-analyzed once this is sorted.
>
> This one's an installation problem rather than anything to do with your
> transcript — re-installing or updating the skill should fix it, and then I
> can build the board from the data that's already saved.

## Why this passes

**What happened** — "part of the whiteboard's own code is missing from the
installed skill". Specific about which part of the system is at fault without
naming a file the user has no reason to know.

**Was work saved** — the folder, and both of the files that matter: the
analysis to read now, and the board data that means the board can still be
produced later.

**What to do next** — re-install or update, then rebuild. The third paragraph
does the real work by naming this as an installation problem, because the
user's default assumption when a run fails is that something about their
material caused it.

## Why this is separate from RE-10

They look similar from outside — no whiteboard, everything else saved — and
the user's next action is completely different.

- **RE-10**: the analysis produced something the board can't use. The fix is
  in the run, and rebuilding the board data is worth trying.
- **RE-11**: the analysis and the board data are both sound. The fix is in the
  installation, and rebuilding the data would change nothing.

Reporting RE-11 as RE-10 sends the user back to look at a synthesis that has
nothing wrong with it. Reporting RE-10 as RE-11 sends them to reinstall a
skill that is working correctly. Neither wastes much time, but both make the
next message harder to trust.

## The thing most likely to go wrong here

Reporting the whiteboard as produced. This case fires at the very last step,
after everything else in the run has gone right, and it's the point at which a
closing summary is most likely to have been half-written already. The rule
holds hardest here: name files confirmed on disk, not the file the run was
supposed to end with.
