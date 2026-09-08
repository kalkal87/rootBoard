# RE-10 — The whiteboard's data isn't usable

Probe P-09. Severity: `halt` for the artifact, `degrade` for the run.

## Trigger

Create a temporary valid JSON file that breaks the board format in five ways,
then run it through the build step:

```
$ python3 "<ROOTBOARD_SKILL_ROOT>/orchestration/scripts/build_whiteboard.py" --board-data "/absolute/path/to/invalid-board-data.json" --out "/tmp/should-not-exist.html"

RE-10: The board data in /absolute/path/to/invalid-board-data.json
breaks the board contract in 5 ways, so the whiteboard was not built:
  - card 1 (id 'card-01') reuses the id 'card-01', already used by card 0. Ids
    must be unique -- the renderer deletes by id, so two cards sharing one id
    disappear together.
  - card 2 (id 'card-03') has no 'problem_statement'. It is required, and
    renders as a blank card face when missing.
  - card 3 (id 'card-04') position.x is 'left', not a finite number.
  - card 3 (id 'card-04') position is missing 'y'.
  - card 4 (id 'card-05') framework entry 0 is a str, not an object with a
    'name'.

Everything earlier in the run is still saved.
$ echo $?
1
$ ls /tmp/should-not-exist.html
ls: /tmp/should-not-exist.html: No such file or directory
```

No file is written. That is the behaviour under test — the probe fails if a
plausible-looking board reaches the user, even though nothing visibly broke.

## Why the renderer won't catch this

Card handling in `renderer/whiteboard/whiteboard.js` is deliberately
forgiving. A missing problem statement becomes an empty string, a non-numeric
position falls back to a staircase by index, a malformed framework entry
becomes "Untitled framework". Nothing throws.

The duplicate id is worse than silent: both cards render, and deleting either
one removes both, because deletion matches on id. A user would meet that as a
card vanishing for no reason, half an hour into working with the board.

That tolerance is right for a renderer that must never fail to open a saved
file, and it's exactly why the check runs before the board is built rather
than relying on the board to complain.

## What the user sees

> I couldn't build the whiteboard from this run. When the synthesis was turned
> into the whiteboard's data file, two cards came out sharing the same
> identifier and one ended up with no problem statement — which would have
> given you a board that opened fine and quietly behaved wrong, so I stopped
> instead of handing it over.
>
> Everything up to that point is saved and worth reading, in
> `~/Documents/rootBoard/runs/2026-08-28-1430-onboarding/`: your
> transcript, all three readings, and `synthesis.md`, which is the full
> analysis in prose and doesn't depend on the board at all.
>
> Want me to rebuild the board data and try again? Nothing needs re-analyzing.

## Why this passes

**What happened** — names the actual defects in plain terms. "Two cards shared
the same identifier" is specific and comprehensible; "duplicate id violates
the board contract" says the same thing in words the user can't act on.

**Was work saved** — the folder, plus the specific pointer to `synthesis.md`
as the thing to read instead. That pointer is what turns this from a dead end
into a usable outcome: the analysis is all there, and the board was only ever
one way of presenting it.

**What to do next** — rebuild, with the reassurance that no re-analysis is
needed.

**The sentence doing the most work** is "would have given you a board that
opened fine and quietly behaved wrong". From outside, stopping looks worse
than shipping something — the user was promised a whiteboard and got a
message. Explaining that the alternative was a board that *looks* right makes
the decision legible instead of arbitrary.

**Avoids the failure signals:** no half-rendered board is presented as the
deliverable, no cards are silently dropped, and the problem is caught before
the artifact is offered rather than surfacing as a browser error later.

## The thing most likely to go wrong here

Dropping the bad cards and rendering the rest. It produces something, it looks
complete, and the user has no way to know that two problems the analysis found
are missing from the board they're now reasoning over. The probe scores that
as a failure even though nothing visibly broke — which is the right call, and
worth remembering whenever "just render what works" seems like the pragmatic
option.
